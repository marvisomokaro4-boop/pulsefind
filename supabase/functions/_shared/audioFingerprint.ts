// Simplified audio fingerprinting for local database matching
// Uses spectral features similar to MFCC for matching

interface AudioFeatures {
  hash: string; // Quick lookup hash
  mfcc: number[][]; // MFCC-like coefficients for similarity matching
  duration_ms: number;
}

/**
 * Generate a simple audio fingerprint from raw audio data
 * This creates a hash for quick exact matching and MFCC features for fuzzy matching
 */
export async function generateAudioFingerprint(
  audioBuffer: ArrayBuffer
): Promise<AudioFeatures> {
  try {
    // Convert to Int16 samples
    const samples = new Int16Array(audioBuffer);
    const sampleCount = samples.length;
    const duration_ms = Math.floor((sampleCount / 44100) * 1000); // Assume 44.1kHz
    
    // Generate quick hash for exact matching
    const hash = await generateQuickHash(samples);
    
    // Extract MFCC-like features for similarity matching
    const mfcc = extractSpectralFeatures(samples);
    
    return {
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
