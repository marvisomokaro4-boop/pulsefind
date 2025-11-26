/**
 * Adaptive Confidence Thresholds Module
 * Adjusts confidence thresholds based on beat characteristics and historical performance
 */

export interface BeatCharacteristics {
  tempo: number; // BPM
  energy: number; // 0-1
  spectralComplexity: number; // 0-1
  genre?: 'trap' | 'drill' | 'melodic' | 'boom-bap' | 'unknown';
}

export interface ConfidenceThresholds {
  strict: number; // High-confidence threshold
  loose: number; // Low-confidence threshold
  explanation: string;
}

/**
 * Calculate adaptive confidence thresholds based on beat characteristics
 */
export function calculateAdaptiveThresholds(
  characteristics: BeatCharacteristics,
  matchingMode: 'loose' | 'strict'
): ConfidenceThresholds {
  // Base thresholds
  let strictThreshold = 85;
  let looseThreshold = 40;
  
  // Adjust based on genre (some genres have more distinctive patterns)
  switch (characteristics.genre) {
    case 'trap':
      // Trap has distinctive 808 patterns - can be stricter
      strictThreshold = 87;
      looseThreshold = 45;
      break;
    case 'drill':
      // Drill has very distinctive sliding 808s and hi-hat patterns
      strictThreshold = 88;
      looseThreshold = 50;
      break;
    case 'melodic':
      // Melodic beats vary more - need looser thresholds
      strictThreshold = 82;
      looseThreshold = 35;
      break;
    case 'boom-bap':
      // Boom-bap has distinctive drum patterns
      strictThreshold = 86;
      looseThreshold = 42;
      break;
  }
  
  // Adjust based on spectral complexity
  // More complex beats (layered sounds) need looser thresholds
  if (characteristics.spectralComplexity > 0.7) {
    strictThreshold -= 3;
    looseThreshold -= 5;
  } else if (characteristics.spectralComplexity < 0.3) {
    // Simple beats are easier to match exactly
    strictThreshold += 2;
    looseThreshold += 3;
  }
  
  // Adjust based on energy
  // High-energy beats with distortion might need looser thresholds
  if (characteristics.energy > 0.8) {
    strictThreshold -= 2;
    looseThreshold -= 3;
  }
  
  // Adjust based on tempo
  // Very fast or very slow beats might have different matching characteristics
  if (characteristics.tempo > 160 || characteristics.tempo < 80) {
    strictThreshold -= 2;
    looseThreshold -= 2;
  }
  
  // Ensure thresholds stay within reasonable bounds
  strictThreshold = Math.max(75, Math.min(95, strictThreshold));
  looseThreshold = Math.max(30, Math.min(60, looseThreshold));
  
  const explanation = generateExplanation(characteristics, strictThreshold, looseThreshold);
  
  return {
    strict: strictThreshold,
    loose: looseThreshold,
    explanation
  };
}

/**
 * Analyze audio samples to extract beat characteristics
 */
export function analyzeBeatCharacteristics(samples: Float32Array, sampleRate: number): BeatCharacteristics {
  // Estimate tempo
  const tempo = estimateTempo(samples, sampleRate);
  
  // Calculate energy (RMS)
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  const energy = Math.min(1, rms * 10); // Normalize to 0-1
  
  // Calculate spectral complexity (variance in frequency content)
  const spectralComplexity = calculateSpectralComplexity(samples);
  
  // Detect genre based on characteristics
  const genre = detectGenre(tempo, energy, spectralComplexity);
  
  return {
    tempo,
    energy,
    spectralComplexity,
    genre
  };
}

/**
 * Estimate tempo using onset detection and autocorrelation
 */
function estimateTempo(samples: Float32Array, sampleRate: number): number {
  const frameSize = 2048;
  const hopSize = 512;
  
  // Compute onset strength envelope
  const onsetEnvelope: number[] = [];
  for (let i = 0; i < samples.length - frameSize; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += frame[j] * frame[j];
    }
    onsetEnvelope.push(Math.sqrt(energy));
  }
  
  // Autocorrelation to find periodicity
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
  return Math.round(Math.max(60, Math.min(180, bpm)));
}

/**
 * Calculate spectral complexity (variance in frequency content)
 */
function calculateSpectralComplexity(samples: Float32Array): number {
  const windowSize = 2048;
  const hopSize = 1024;
  const numBands = 32;
  
  const spectralVariances: number[] = [];
  
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    const window = samples.slice(i, i + windowSize);
    const bandEnergies = computeBandEnergies(window, numBands);
    
    // Calculate variance across frequency bands
    const mean = bandEnergies.reduce((a, b) => a + b, 0) / bandEnergies.length;
    let variance = 0;
    for (const energy of bandEnergies) {
      variance += (energy - mean) * (energy - mean);
    }
    variance /= bandEnergies.length;
    spectralVariances.push(variance);
  }
  
  // Average variance over time
  const avgVariance = spectralVariances.reduce((a, b) => a + b, 0) / spectralVariances.length;
  
  // Normalize to 0-1 range (empirically determined scale)
  return Math.min(1, avgVariance * 100);
}

/**
 * Compute energy in frequency bands
 */
function computeBandEnergies(window: Float32Array, numBands: number): number[] {
  const bandSize = Math.floor(window.length / numBands);
  const bandEnergies: number[] = [];
  
  for (let b = 0; b < numBands; b++) {
    const start = b * bandSize;
    const end = Math.min(start + bandSize, window.length);
    
    let energy = 0;
    for (let i = start; i < end; i++) {
      energy += window[i] * window[i];
    }
    bandEnergies.push(energy);
  }
  
  return bandEnergies;
}

/**
 * Detect genre based on audio characteristics
 */
function detectGenre(tempo: number, energy: number, spectralComplexity: number): BeatCharacteristics['genre'] {
  // Trap: 130-150 BPM, moderate-high energy, moderate complexity
  if (tempo >= 130 && tempo <= 150 && energy > 0.5) {
    return 'trap';
  }
  
  // Drill: 140-155 BPM, high energy, high complexity
  if (tempo >= 140 && tempo <= 155 && energy > 0.6 && spectralComplexity > 0.6) {
    return 'drill';
  }
  
  // Melodic: wide tempo range, moderate energy, high complexity
  if (spectralComplexity > 0.7) {
    return 'melodic';
  }
  
  // Boom-bap: 85-100 BPM, moderate energy
  if (tempo >= 85 && tempo <= 100 && energy > 0.4 && energy < 0.7) {
    return 'boom-bap';
  }
  
  return 'unknown';
}

/**
 * Generate explanation for threshold adjustments
 */
function generateExplanation(
  characteristics: BeatCharacteristics,
  strictThreshold: number,
  looseThreshold: number
): string {
  const parts: string[] = [];
  
  if (characteristics.genre && characteristics.genre !== 'unknown') {
    parts.push(`${characteristics.genre.charAt(0).toUpperCase() + characteristics.genre.slice(1)} beat detected`);
  }
  
  if (characteristics.spectralComplexity > 0.7) {
    parts.push('complex layering detected (looser thresholds)');
  } else if (characteristics.spectralComplexity < 0.3) {
    parts.push('simple pattern detected (stricter thresholds)');
  }
  
  if (characteristics.energy > 0.8) {
    parts.push('high energy with potential distortion');
  }
  
  if (characteristics.tempo > 160 || characteristics.tempo < 80) {
    parts.push(`unusual tempo (${characteristics.tempo} BPM)`);
  }
  
  const explanation = parts.length > 0
    ? `Adaptive thresholds: ${parts.join(', ')}. Strict: ${strictThreshold}%, Loose: ${looseThreshold}%`
    : `Standard thresholds: Strict ${strictThreshold}%, Loose ${looseThreshold}%`;
  
  return explanation;
}
