// Chromaprint-style binary fingerprinting for local database matching
// Uses binary fingerprints with Hamming distance for exact match detection

interface AudioFeatures {
  binaryFingerprint: string; // Binary fingerprint (hex string) for Hamming distance
  hash: string; // Quick lookup hash
  mfcc: number[][]; // MFCC-like coefficients for fuzzy similarity matching
  duration_ms: number;
}

/**
 * Generate Chromaprint-style binary fingerprint from raw audio data
 * Creates binary fingerprint for Hamming distance matching + hash + MFCC for fuzzy matching
 */
export async function generateAudioFingerprint(
  audioBuffer: ArrayBuffer
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
    
    return {
      binaryFingerprint,
      hash,
      mfcc,
      duration_ms
    };
  } catch (error) {
    console.error('Fingerprint generation error:', error);
    throw error;
  }
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
