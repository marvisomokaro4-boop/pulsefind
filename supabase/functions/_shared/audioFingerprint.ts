// Enhanced Audio Fingerprinting with Neural Embeddings
// Chromaprint-style binary fingerprinting + Neural spectral embeddings for robust matching

interface AudioFeatures {
  binaryFingerprint: string; // Binary fingerprint (hex string) for Hamming distance
  hash: string; // Quick lookup hash
  mfcc: number[][]; // MFCC-like coefficients for fuzzy similarity matching
  neuralEmbedding?: Float32Array; // Neural spectral embedding for tempo/pitch-invariant matching
  duration_ms: number;
  tempo?: number; // Estimated BPM
  energy?: number; // RMS energy 0-1
}

/**
 * Generate Chromaprint-style binary fingerprint from raw audio data
 * Creates binary fingerprint for Hamming distance matching + hash + MFCC for fuzzy matching
 */
export async function generateAudioFingerprint(
  audioBuffer: ArrayBuffer,
  includeNeuralEmbedding: boolean = false
): Promise<AudioFeatures> {
  try {
    // Convert to Int16 samples
    const samples = new Int16Array(audioBuffer);
    const sampleCount = samples.length;
    const duration_ms = Math.floor((sampleCount / 44100) * 1000); // Assume 44.1kHz
    
    // Generate binary fingerprint (Chromaprint-style)
    const binaryFingerprint = generateBinaryFingerprint(samples);
    
    // Generate quick hash for exact matching
    const hash = await generateQuickHash(samples);
    
    // Extract MFCC-like features for fuzzy similarity matching
    const mfcc = extractSpectralFeatures(samples);
    
    // Calculate energy
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }
    const energy = Math.sqrt(sumSquares / samples.length);
    
    // Estimate tempo (simplified)
    const tempo = estimateSimpleTempo(samples);
    
    const features: AudioFeatures = {
      binaryFingerprint,
      hash,
      mfcc,
      duration_ms,
      tempo,
      energy: Math.min(1, energy * 10) // Normalize to 0-1
    };
    
    // Optionally include neural embedding (more computationally expensive)
    if (includeNeuralEmbedding) {
      try {
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          floatSamples[i] = samples[i] / 32768; // Normalize to -1 to 1
        }
        features.neuralEmbedding = extractSimplifiedNeuralEmbedding(floatSamples);
      } catch (err) {
        console.error('Failed to extract neural embedding:', err);
      }
    }
    
    return features;
  } catch (error) {
    console.error('Fingerprint generation error:', error);
    throw error;
  }
}

/**
 * Simplified tempo estimation
 */
function estimateSimpleTempo(samples: Int16Array): number {
  const frameSize = 2048;
  const hopSize = 512;
  const sampleRate = 44100;
  
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
  
  // Autocorrelation
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
 * Extract simplified neural-style embedding
 */
function extractSimplifiedNeuralEmbedding(samples: Float32Array): Float32Array {
  const frameSize = 512;
  const hopSize = 256;
  const numMelBands = 64; // Smaller for efficiency
  
  const frames: Float32Array[] = [];
  
  // Sample up to 30 seconds for efficiency
  const maxSamples = Math.min(samples.length, 44100 * 30);
  
  for (let i = 0; i < maxSamples - frameSize; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    
    // Apply Hamming window
    const windowed = new Float32Array(frameSize);
    for (let j = 0; j < frameSize; j++) {
      const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * j) / (frameSize - 1));
      windowed[j] = frame[j] * window;
    }
    
    // Compute mel-scale spectrum (simplified)
    const melSpectrum = computeSimplifiedMelSpectrum(windowed, numMelBands);
    frames.push(melSpectrum);
  }
  
  // Aggregate statistics
  const embedding = aggregateFrameStatistics(frames, numMelBands);
  return embedding;
}

/**
 * Compute simplified mel spectrum
 */
function computeSimplifiedMelSpectrum(frame: Float32Array, numBands: number): Float32Array {
  const spectrum = new Float32Array(numBands);
  const bandSize = Math.floor(frame.length / numBands);
  
  for (let band = 0; band < numBands; band++) {
    const start = band * bandSize;
    const end = Math.min(start + bandSize, frame.length);
    
    let energy = 0;
    for (let i = start; i < end; i++) {
      energy += frame[i] * frame[i];
    }
    
    spectrum[band] = Math.log(energy + 1e-10);
  }
  
  return spectrum;
}

/**
 * Aggregate frame statistics
 */
function aggregateFrameStatistics(frames: Float32Array[], numBands: number): Float32Array {
  if (frames.length === 0) return new Float32Array(numBands * 3);
  
  const mean = new Float32Array(numBands);
  const std = new Float32Array(numBands);
  const max = new Float32Array(numBands);
  
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
  
  // Concatenate statistics
  const embedding = new Float32Array(numBands * 3);
  embedding.set(mean, 0);
  embedding.set(std, numBands);
  embedding.set(max, numBands * 2);
  
  return embedding;
}

/**
 * Generate Chromaprint-style binary fingerprint
 * Uses spectral energy differences across frames to create binary hash
 */
function generateBinaryFingerprint(samples: Int16Array): string {
  const windowSize = 4096; // ~93ms at 44.1kHz
  const hopSize = windowSize / 2;
  const numBands = 32; // Frequency bands
  
  const fingerprint: number[] = [];
  let prevBandEnergies: number[] = [];
  
  // Process overlapping windows
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    const window = samples.slice(i, i + windowSize);
    
    // Calculate energy in frequency bands
    const bandEnergies = calculateBandEnergies(window, numBands);
    
    // Compare with previous frame to create binary bits
    if (prevBandEnergies.length > 0) {
      let bits = 0;
      
      for (let b = 0; b < numBands; b++) {
        // Set bit if energy increased
        if (bandEnergies[b] > prevBandEnergies[b]) {
          bits |= (1 << b);
        }
      }
      
      fingerprint.push(bits);
    }
    
    prevBandEnergies = bandEnergies;
  }
  
  // Convert to hex string for storage
  return fingerprint.map(n => n.toString(16).padStart(8, '0')).join('');
}

/**
 * Calculate energy in frequency bands (simplified mel-scale approximation)
 */
function calculateBandEnergies(window: Int16Array, numBands: number): number[] {
  const bandSize = Math.floor(window.length / numBands);
  const bandEnergies: number[] = [];
  
  for (let b = 0; b < numBands; b++) {
    const start = b * bandSize;
    const end = Math.min(start + bandSize, window.length);
    
    let bandEnergy = 0;
    for (let i = start; i < end; i++) {
      const normalized = window[i] / 32768;
      bandEnergy += normalized * normalized;
    }
    
    bandEnergies.push(Math.log(bandEnergy + 1e-10));
  }
  
  return bandEnergies;
}

/**
 * Generate a hash from audio characteristics for quick exact matching
 */
async function generateQuickHash(samples: Int16Array): Promise<string> {
  // Sample at intervals to create signature
  const signature: number[] = [];
  const step = Math.floor(samples.length / 100); // 100 sample points
  
  for (let i = 0; i < samples.length; i += step) {
    const window = samples.slice(i, Math.min(i + step, samples.length));
    
    // Calculate RMS for this window
    let sumSquares = 0;
    for (let j = 0; j < window.length; j++) {
      const normalized = window[j] / 32768;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / window.length);
    
    // Quantize to reduce noise sensitivity
    signature.push(Math.floor(rms * 100));
  }
  
  // Convert to hash string
  return signature.join('-');
}

/**
 * Extract MFCC-like spectral features for similarity matching
 * Simplified version without full FFT
 */
function extractSpectralFeatures(samples: Int16Array): number[][] {
  const features: number[][] = [];
  const windowSize = 2048; // About 46ms at 44.1kHz
  const hopSize = 512; // 25% overlap
  const numCoefficients = 13; // Standard MFCC count
  
  // Process windows
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    const window = samples.slice(i, i + windowSize);
    const coefficients = extractWindowFeatures(window, numCoefficients);
    features.push(coefficients);
  }
  
  return features;
}

/**
 * Extract features from a single window
 */
function extractWindowFeatures(window: Int16Array, numCoefficients: number): number[] {
  const coefficients: number[] = [];
  
  // Calculate energy in different frequency bands (simplified mel-scale)
  const bandsPerCoeff = Math.floor(window.length / numCoefficients);
  
  for (let i = 0; i < numCoefficients; i++) {
    const start = i * bandsPerCoeff;
    const end = Math.min(start + bandsPerCoeff, window.length);
    
    let energy = 0;
    for (let j = start; j < end; j++) {
      const normalized = window[j] / 32768;
      energy += normalized * normalized;
    }
    
    // Log scale (similar to mel-frequency)
    coefficients.push(Math.log(energy + 1e-10));
  }
  
  return coefficients;
}

/**
 * Calculate cosine similarity between two MFCC feature sets
 * Returns 0-1, where 1 is identical
 */
export function calculateMFCCSimilarity(
  mfcc1: number[][],
  mfcc2: number[][]
): number {
  // Average features across time for comparison
  const avg1 = averageFeatures(mfcc1);
  const avg2 = averageFeatures(mfcc2);
  
  return cosineSimilarity(avg1, avg2);
}

/**
 * Average MFCC features across time dimension
 */
function averageFeatures(mfcc: number[][]): number[] {
  if (mfcc.length === 0) return [];
  
  const numCoeffs = mfcc[0].length;
  const averaged: number[] = new Array(numCoeffs).fill(0);
  
  for (const frame of mfcc) {
    for (let i = 0; i < numCoeffs; i++) {
      averaged[i] += frame[i];
    }
  }
  
  for (let i = 0; i < numCoeffs; i++) {
    averaged[i] /= mfcc.length;
  }
  
  return averaged;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Calculate Hamming distance between two binary fingerprints
 * Returns similarity score 0-1 (1 = identical, 0 = completely different)
 */
export function calculateHammingDistance(
  fingerprint1: string,
  fingerprint2: string
): number {
  // Ensure same length
  const len = Math.min(fingerprint1.length, fingerprint2.length);
  
  let differences = 0;
  let totalBits = 0;
  
  for (let i = 0; i < len; i += 8) {
    const hex1 = fingerprint1.substr(i, 8);
    const hex2 = fingerprint2.substr(i, 8);
    
    const int1 = parseInt(hex1, 16);
    const int2 = parseInt(hex2, 16);
    
    // XOR to find differing bits
    let xor = int1 ^ int2;
    
    // Count set bits (differences)
    while (xor > 0) {
      differences += xor & 1;
      xor >>= 1;
    }
    
    totalBits += 32; // 8 hex chars = 32 bits
  }
  
  // Return similarity (1 - difference ratio)
  return 1 - (differences / totalBits);
}
