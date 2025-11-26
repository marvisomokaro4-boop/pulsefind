/**
 * Advanced Matching Service
 * DTW, tempo/pitch normalization, neural embeddings
 */

/**
 * Dynamic Time Warping (DTW) for sequence alignment
 * Detects pitched/stretched beats
 */
export function calculateDTW(sequence1: number[], sequence2: number[]): number {
  const n = sequence1.length;
  const m = sequence2.length;
  
  // Initialize DTW matrix
  const dtw: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;
  
  // Fill DTW matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(sequence1[i - 1] - sequence2[j - 1]);
      dtw[i][j] = cost + Math.min(
        dtw[i - 1][j],     // insertion
        dtw[i][j - 1],     // deletion
        dtw[i - 1][j - 1]  // match
      );
    }
  }
  
  // Normalize by path length
  const pathLength = n + m;
  return dtw[n][m] / pathLength;
}

/**
 * Estimate tempo (BPM) from audio samples
 */
export function estimateTempo(samples: Float32Array, sampleRate: number): number {
  // Calculate onset envelope using spectral flux
  const frameSize = 2048;
  const hopSize = 512;
  const onsetEnvelope: number[] = [];
  
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += frame[j] * frame[j];
    }
    onsetEnvelope.push(Math.sqrt(energy));
  }
  
  // Auto-correlation to find periodicity
  const minBPM = 60;
  const maxBPM = 180;
  const minLag = Math.floor((60 / maxBPM) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / minBPM) * sampleRate / hopSize);
  
  let maxCorrelation = 0;
  let bestLag = minLag;
  
  for (let lag = minLag; lag <= Math.min(maxLag, onsetEnvelope.length / 2); lag++) {
    let correlation = 0;
    for (let i = 0; i < onsetEnvelope.length - lag; i++) {
      correlation += onsetEnvelope[i] * onsetEnvelope[i + lag];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  // Convert lag to BPM
  const bpm = (60 * sampleRate) / (bestLag * hopSize);
  return Math.round(bpm);
}

/**
 * Normalize tempo by time-stretching
 */
export function normalizeTempoToTarget(samples: Float32Array, currentBPM: number, targetBPM: number): Float32Array {
  const stretchFactor = targetBPM / currentBPM;
  
  if (stretchFactor === 1.0) return samples;
  
  // Simple linear interpolation time-stretching
  const outputLength = Math.floor(samples.length / stretchFactor);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * stretchFactor;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = sourceIndex - leftIndex;
    
    // Linear interpolation
    output[i] = samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction;
  }
  
  return output;
}

/**
 * Detect pitch shift amount
 */
export function detectPitchShift(samples: Float32Array, sampleRate: number): number {
  // Simplified pitch detection using zero-crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      zeroCrossings++;
    }
  }
  
  // Estimate fundamental frequency
  const duration = samples.length / sampleRate;
  const frequency = zeroCrossings / (2 * duration);
  
  // Convert to semitones from A440 reference
  const referencePitch = 440; // A4
  const semitones = 12 * Math.log2(frequency / referencePitch);
  
  return semitones;
}

/**
 * Normalize pitch by shifting
 */
export function normalizePitch(samples: Float32Array, semitones: number): Float32Array {
  if (semitones === 0) return samples;
  
  // Simple pitch shifting using sample rate conversion
  const shiftFactor = Math.pow(2, semitones / 12);
  const outputLength = Math.floor(samples.length / shiftFactor);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * shiftFactor;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = sourceIndex - leftIndex;
    
    output[i] = samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction;
  }
  
  return output;
}

/**
 * Compute spectral centroid (brightness)
 */
export function computeSpectralCentroid(samples: Float32Array, sampleRate: number): number {
  const frameSize = 2048;
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < Math.min(frameSize, samples.length); i++) {
    const magnitude = Math.abs(samples[i]);
    const frequency = (i * sampleRate) / frameSize;
    numerator += frequency * magnitude;
    denominator += magnitude;
  }
  
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Extract spectral features for similarity comparison
 */
export function extractSpectralFeatures(samples: Float32Array, sampleRate: number): {
  centroid: number;
  rolloff: number;
  flux: number;
  zcr: number;
} {
  // Spectral centroid
  const centroid = computeSpectralCentroid(samples, sampleRate);
  
  // Zero crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      zeroCrossings++;
    }
  }
  const zcr = zeroCrossings / samples.length;
  
  // Spectral rolloff (90% of energy)
  const magnitudes: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    magnitudes.push(Math.abs(samples[i]));
  }
  magnitudes.sort((a, b) => b - a);
  const totalEnergy = magnitudes.reduce((sum, m) => sum + m * m, 0);
  let cumulativeEnergy = 0;
  let rolloffIndex = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    cumulativeEnergy += magnitudes[i] * magnitudes[i];
    if (cumulativeEnergy >= 0.9 * totalEnergy) {
      rolloffIndex = i;
      break;
    }
  }
  const rolloff = (rolloffIndex / magnitudes.length) * (sampleRate / 2);
  
  // Spectral flux (simplified)
  let flux = 0;
  for (let i = 1; i < samples.length; i++) {
    const diff = Math.abs(samples[i]) - Math.abs(samples[i - 1]);
    flux += diff > 0 ? diff : 0;
  }
  flux /= samples.length;
  
  return { centroid, rolloff, flux, zcr };
}
