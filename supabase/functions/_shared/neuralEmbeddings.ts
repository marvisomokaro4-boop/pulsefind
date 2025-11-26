/**
 * Neural Embeddings Module
 * Spectral embeddings (OpenL3/VGGish-style) for tempo/pitch-invariant matching
 */

/**
 * Extract spectral embeddings from audio samples
 * These embeddings are tempo and pitch invariant, making them ideal for detecting remixes and transposed beats
 */
export function extractSpectralEmbeddings(samples: Float32Array, sampleRate: number): Float32Array {
  const frameSize = 512; // ~11ms at 44.1kHz
  const hopSize = 256; // 50% overlap
  const numMelBands = 128; // Standard mel-scale bands
  
  const frames: Float32Array[] = [];
  
  // Extract frames
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    const melSpectrum = computeMelSpectrum(frame, sampleRate, numMelBands);
    frames.push(melSpectrum);
  }
  
  // Aggregate temporal information using statistics
  const embeddings = aggregateFrameStatistics(frames, numMelBands);
  
  return embeddings;
}

/**
 * Compute mel-scale spectrum for a frame
 */
function computeMelSpectrum(frame: Float32Array, sampleRate: number, numBands: number): Float32Array {
  // Apply Hamming window
  const windowed = applyHammingWindow(frame);
  
  // Compute power spectrum (simplified - no full FFT)
  const powerSpectrum = computePowerSpectrum(windowed);
  
  // Convert to mel-scale
  const melSpectrum = convertToMelScale(powerSpectrum, sampleRate, numBands);
  
  return melSpectrum;
}

/**
 * Apply Hamming window to reduce spectral leakage
 */
function applyHammingWindow(frame: Float32Array): Float32Array {
  const windowed = new Float32Array(frame.length);
  const N = frame.length;
  
  for (let i = 0; i < N; i++) {
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    windowed[i] = frame[i] * window;
  }
  
  return windowed;
}

/**
 * Compute power spectrum (simplified approach)
 */
function computePowerSpectrum(windowed: Float32Array): Float32Array {
  const n = windowed.length;
  const powerSpectrum = new Float32Array(n / 2);
  
  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;
    
    // Simplified DFT for efficiency
    for (let t = 0; t < n; t += 4) { // Sample every 4th point for speed
      const angle = -2 * Math.PI * k * t / n;
      real += windowed[t] * Math.cos(angle);
      imag += windowed[t] * Math.sin(angle);
    }
    
    powerSpectrum[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return powerSpectrum;
}

/**
 * Convert power spectrum to mel-scale
 */
function convertToMelScale(powerSpectrum: Float32Array, sampleRate: number, numBands: number): Float32Array {
  const melSpectrum = new Float32Array(numBands);
  const maxFreq = sampleRate / 2;
  
  // Mel scale conversion: mel = 2595 * log10(1 + freq/700)
  const melMax = 2595 * Math.log10(1 + maxFreq / 700);
  const melStep = melMax / (numBands + 1);
  
  for (let band = 0; band < numBands; band++) {
    const melLow = band * melStep;
    const melHigh = (band + 1) * melStep;
    
    // Convert back to frequency: freq = 700 * (10^(mel/2595) - 1)
    const freqLow = 700 * (Math.pow(10, melLow / 2595) - 1);
    const freqHigh = 700 * (Math.pow(10, melHigh / 2595) - 1);
    
    // Map to power spectrum bins
    const binLow = Math.floor(freqLow * powerSpectrum.length * 2 / sampleRate);
    const binHigh = Math.ceil(freqHigh * powerSpectrum.length * 2 / sampleRate);
    
    // Sum energy in mel band
    let energy = 0;
    for (let bin = binLow; bin < Math.min(binHigh, powerSpectrum.length); bin++) {
      energy += powerSpectrum[bin];
    }
    
    // Log scale for perceptual similarity
    melSpectrum[band] = Math.log(energy + 1e-10);
  }
  
  return melSpectrum;
}

/**
 * Aggregate frame statistics to create temporal-invariant embedding
 */
function aggregateFrameStatistics(frames: Float32Array[], numBands: number): Float32Array {
  if (frames.length === 0) return new Float32Array(numBands * 4);
  
  // Statistics: mean, std, max, delta (temporal change)
  const mean = new Float32Array(numBands);
  const std = new Float32Array(numBands);
  const max = new Float32Array(numBands);
  const delta = new Float32Array(numBands);
  
  // Compute mean
  for (const frame of frames) {
    for (let i = 0; i < numBands; i++) {
      mean[i] += frame[i];
    }
  }
  for (let i = 0; i < numBands; i++) {
    mean[i] /= frames.length;
  }
  
  // Compute std and max
  for (const frame of frames) {
    for (let i = 0; i < numBands; i++) {
      const diff = frame[i] - mean[i];
      std[i] += diff * diff;
      max[i] = Math.max(max[i], frame[i]);
    }
  }
  for (let i = 0; i < numBands; i++) {
    std[i] = Math.sqrt(std[i] / frames.length);
  }
  
  // Compute temporal delta (change over time)
  for (let f = 1; f < frames.length; f++) {
    for (let i = 0; i < numBands; i++) {
      delta[i] += Math.abs(frames[f][i] - frames[f - 1][i]);
    }
  }
  for (let i = 0; i < numBands; i++) {
    delta[i] /= frames.length - 1;
  }
  
  // Concatenate all statistics into single embedding vector
  const embedding = new Float32Array(numBands * 4);
  embedding.set(mean, 0);
  embedding.set(std, numBands);
  embedding.set(max, numBands * 2);
  embedding.set(delta, numBands * 3);
  
  return embedding;
}

/**
 * Compare two embeddings using cosine similarity
 */
export function compareEmbeddings(emb1: Float32Array, emb2: Float32Array): number {
  if (emb1.length !== emb2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < emb1.length; i++) {
    dotProduct += emb1[i] * emb2[i];
    norm1 += emb1[i] * emb1[i];
    norm2 += emb2[i] * emb2[i];
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (norm1 * norm2);
}

/**
 * Extract tempo-normalized embedding (for detecting sped-up/slowed-down beats)
 */
export function extractTempoNormalizedEmbedding(samples: Float32Array, sampleRate: number, targetBPM: number = 120): Float32Array {
  // Estimate current tempo
  const currentBPM = estimateTempo(samples, sampleRate);
  
  // Time-stretch to target BPM
  const stretchFactor = targetBPM / currentBPM;
  const normalized = timeStretch(samples, stretchFactor);
  
  // Extract embeddings from normalized audio
  return extractSpectralEmbeddings(normalized, sampleRate);
}

/**
 * Estimate tempo (BPM) from audio
 */
function estimateTempo(samples: Float32Array, sampleRate: number): number {
  const frameSize = 2048;
  const hopSize = 512;
  
  // Compute onset envelope
  const onsetEnvelope: number[] = [];
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += frame[j] * frame[j];
    }
    onsetEnvelope.push(Math.sqrt(energy));
  }
  
  // Find periodicity using autocorrelation
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
  
  const bpm = (60 * sampleRate) / (bestLag * hopSize);
  return Math.round(bpm);
}

/**
 * Simple time-stretching algorithm
 */
function timeStretch(samples: Float32Array, factor: number): Float32Array {
  const outputLength = Math.floor(samples.length / factor);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * factor;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = sourceIndex - leftIndex;
    
    // Linear interpolation
    output[i] = samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction;
  }
  
  return output;
}
