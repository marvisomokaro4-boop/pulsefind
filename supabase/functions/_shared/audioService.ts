/**
 * Audio Service - Enhanced Preprocessing
 * Handles audio normalization, silence trimming, segmentation
 * Target: 16-bit PCM WAV, 44.1kHz mono
 */

export interface AudioSegment {
  data: ArrayBuffer;
  type: 'start' | 'middle' | 'end' | 'full';
  timestamp: number;
  duration: number;
}

export interface PreprocessingMetrics {
  originalSize: number;
  processedSize: number;
  originalDuration: number;
  processedDuration: number;
  silenceTrimmedMs: number;
  volumeNormalized: boolean;
  qualityScore: number;
}

/**
 * Analyze audio quality metrics
 */
export function analyzeAudioQuality(samples: Float32Array): number {
  // Calculate RMS (Root Mean Square) for volume analysis
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  
  // Calculate zero crossings (indicator of signal complexity)
  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = zeroCrossings / samples.length;
  
  // Combined quality score (0-1)
  // Good audio should have decent RMS and reasonable zero crossing rate
  const rmsScore = Math.min(rms * 10, 1); // Scale to 0-1
  const zcrScore = Math.min(zeroCrossingRate * 100, 1); // Scale to 0-1
  
  return (rmsScore + zcrScore) / 2;
}

/**
 * Detect silence in audio buffer
 */
export function detectSilence(samples: Float32Array, threshold = 0.01): { start: number; end: number } {
  let start = 0;
  let end = samples.length - 1;
  
  // Find start of audio (trim leading silence)
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      start = i;
      break;
    }
  }
  
  // Find end of audio (trim trailing silence)
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) > threshold) {
      end = i;
      break;
    }
  }
  
  return { start, end };
}

/**
 * Normalize audio volume using peak normalization
 */
export function normalizeVolume(samples: Float32Array): Float32Array {
  // Find peak amplitude
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  
  // Avoid division by zero
  if (peak === 0) return samples;
  
  // Normalize to 0.9 to prevent clipping
  const targetPeak = 0.9;
  const gain = targetPeak / peak;
  
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * gain;
  }
  
  return normalized;
}

/**
 * Create strategic audio segments for matching
 */
export function createStrategicSegments(
  buffer: ArrayBuffer,
  segmentDurations: number[] = [15, 20, 30] // seconds
): AudioSegment[] {
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true); // WAV header offset for sample rate
  const dataStart = 44; // Standard WAV header size
  const totalSamples = (buffer.byteLength - dataStart) / 2; // 16-bit samples
  const totalDuration = totalSamples / sampleRate;
  
  const segments: AudioSegment[] = [];
  
  // Full audio segment
  segments.push({
    data: buffer,
    type: 'full',
    timestamp: 0,
    duration: totalDuration
  });
  
  // Create segments of different durations at strategic positions
  for (const duration of segmentDurations) {
    const segmentSamples = duration * sampleRate;
    const segmentBytes = segmentSamples * 2; // 16-bit = 2 bytes per sample
    
    // Start segment (0%)
    if (totalSamples >= segmentSamples) {
      const startSegment = createWavSegment(buffer, 0, segmentBytes);
      segments.push({
        data: startSegment,
        type: 'start',
        timestamp: 0,
        duration
      });
    }
    
    // Middle segment (50%)
    const middleOffset = Math.floor((totalSamples - segmentSamples) / 2) * 2;
    if (middleOffset > 0 && totalSamples >= segmentSamples) {
      const middleSegment = createWavSegment(buffer, middleOffset, segmentBytes);
      segments.push({
        data: middleSegment,
        type: 'middle',
        timestamp: middleOffset / (sampleRate * 2),
        duration
      });
    }
    
    // End segment (90%)
    const endOffset = Math.floor((totalSamples - segmentSamples) * 0.9) * 2;
    if (endOffset > 0 && totalSamples >= segmentSamples) {
      const endSegment = createWavSegment(buffer, endOffset, segmentBytes);
      segments.push({
        data: endSegment,
        type: 'end',
        timestamp: endOffset / (sampleRate * 2),
        duration
      });
    }
  }
  
  return segments;
}

/**
 * Create a WAV segment from main buffer
 */
function createWavSegment(buffer: ArrayBuffer, offset: number, length: number): ArrayBuffer {
  const headerSize = 44;
  const segmentBuffer = new ArrayBuffer(headerSize + length);
  const segmentView = new DataView(segmentBuffer);
  const sourceView = new DataView(buffer);
  
  // Copy WAV header
  for (let i = 0; i < headerSize; i++) {
    segmentView.setUint8(i, sourceView.getUint8(i));
  }
  
  // Update data chunk size
  segmentView.setUint32(40, length, true);
  segmentView.setUint32(4, 36 + length, true);
  
  // Copy audio data
  const sourceData = new Uint8Array(buffer, headerSize + offset, length);
  const segmentData = new Uint8Array(segmentBuffer, headerSize);
  segmentData.set(sourceData);
  
  return segmentBuffer;
}

/**
 * Calculate spectral flux for onset detection
 */
export function calculateSpectralFlux(samples: Float32Array, frameSize = 2048): number[] {
  const flux: number[] = [];
  const numFrames = Math.floor(samples.length / frameSize);
  
  let prevMagnitudes: number[] = [];
  
  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * frameSize;
    const end = start + frameSize;
    const frameData = samples.slice(start, end);
    
    // Simple magnitude calculation (simplified FFT alternative)
    const magnitudes: number[] = [];
    for (let i = 0; i < frameData.length; i += 4) {
      const mag = Math.abs(frameData[i]);
      magnitudes.push(mag);
    }
    
    // Calculate flux (difference from previous frame)
    if (prevMagnitudes.length > 0) {
      let sum = 0;
      for (let i = 0; i < Math.min(magnitudes.length, prevMagnitudes.length); i++) {
        const diff = magnitudes[i] - prevMagnitudes[i];
        sum += diff > 0 ? diff : 0; // Only positive differences
      }
      flux.push(sum);
    } else {
      flux.push(0);
    }
    
    prevMagnitudes = magnitudes;
  }
  
  return flux;
}
