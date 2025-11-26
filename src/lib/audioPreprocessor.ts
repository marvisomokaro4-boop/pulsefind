/**
 * Audio Preprocessing Utility
 * Converts uploaded audio files to standardized format before fingerprinting
 * Target: 16-bit PCM WAV, 44.1kHz mono
 */

export class AudioPreprocessor {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  /**
   * Convert audio file to standardized WAV format with enhanced preprocessing
   * @param file - Original audio file
   * @returns Preprocessed audio blob in WAV format
   */
  async preprocessAudio(file: File): Promise<Blob> {
    console.log('[AUDIO-PREPROCESS] Starting enhanced preprocessing:', {
      fileName: file.name,
      originalSize: file.size,
      originalType: file.type
    });

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('[AUDIO-PREPROCESS] Decoded audio:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      });

      // Convert to mono if stereo
      let monoBuffer = this.convertToMono(audioBuffer);
      
      // Get samples for processing
      const originalSamples = monoBuffer.getChannelData(0);
      
      // Volume normalization
      const normalizedSamples = this.normalizeVolume(originalSamples);
      console.log('[AUDIO-PREPROCESS] Volume normalized');
      
      // Silence trimming
      const { start, end } = this.detectSilence(normalizedSamples);
      const trimmedSamples = normalizedSamples.slice(start, end);
      const silenceTrimmedMs = ((start + (normalizedSamples.length - end)) / monoBuffer.sampleRate) * 1000;
      console.log('[AUDIO-PREPROCESS] Silence trimmed:', { silenceTrimmedMs: silenceTrimmedMs.toFixed(0) });
      
      // Create new buffer with processed samples
      const processedBuffer = this.audioContext.createBuffer(
        1,
        trimmedSamples.length,
        monoBuffer.sampleRate
      );
      processedBuffer.getChannelData(0).set(trimmedSamples);
      
      // Resample to 44.1kHz if needed
      const resampledBuffer = await this.resampleTo44100(processedBuffer);
      
      // Audio quality analysis
      const qualityScore = this.analyzeQuality(resampledBuffer.getChannelData(0));
      console.log('[AUDIO-PREPROCESS] Quality score:', qualityScore.toFixed(4));
      
      // Convert to 16-bit PCM WAV
      const wavBlob = this.encodeWAV(resampledBuffer);
      
      console.log('[AUDIO-PREPROCESS] Enhanced preprocessing complete:', {
        outputSize: wavBlob.size,
        outputType: wavBlob.type,
        compressionRatio: (file.size / wavBlob.size).toFixed(2),
        qualityScore: qualityScore.toFixed(4),
        silenceTrimmedMs: silenceTrimmedMs.toFixed(0)
      });

      return wavBlob;
    } catch (error) {
      console.error('[AUDIO-PREPROCESS] Failed:', error);
      throw new Error(`Audio preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze audio quality
   */
  private analyzeQuality(samples: Float32Array): number {
    // Calculate RMS
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    
    // Calculate zero crossings
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / samples.length;
    
    // Combined quality score
    const rmsScore = Math.min(rms * 10, 1);
    const zcrScore = Math.min(zcr * 100, 1);
    
    return (rmsScore + zcrScore) / 2;
  }

  /**
   * Normalize audio volume
   */
  private normalizeVolume(samples: Float32Array): Float32Array {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }
    
    if (peak === 0) return samples;
    
    const targetPeak = 0.9;
    const gain = targetPeak / peak;
    
    const normalized = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      normalized[i] = samples[i] * gain;
    }
    
    return normalized;
  }

  /**
   * Detect silence boundaries
   */
  private detectSilence(samples: Float32Array, threshold = 0.01): { start: number; end: number } {
    let start = 0;
    let end = samples.length - 1;
    
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > threshold) {
        start = i;
        break;
      }
    }
    
    for (let i = samples.length - 1; i >= 0; i--) {
      if (Math.abs(samples[i]) > threshold) {
        end = i;
        break;
      }
    }
    
    return { start, end };
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  private convertToMono(audioBuffer: AudioBuffer): AudioBuffer {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer;
    }

    const monoBuffer = this.audioContext.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const monoData = monoBuffer.getChannelData(0);
    
    // Average all channels
    for (let i = 0; i < audioBuffer.length; i++) {
      let sum = 0;
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        sum += audioBuffer.getChannelData(channel)[i];
      }
      monoData[i] = sum / audioBuffer.numberOfChannels;
    }

    console.log('[AUDIO-PREPROCESS] Converted to mono');
    return monoBuffer;
  }

  /**
   * Resample audio to 44.1kHz
   */
  private async resampleTo44100(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    const targetSampleRate = 44100;
    
    if (audioBuffer.sampleRate === targetSampleRate) {
      return audioBuffer;
    }

    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const resampledBuffer = await offlineContext.startRendering();
    console.log('[AUDIO-PREPROCESS] Resampled to 44.1kHz');
    
    return resampledBuffer;
  }

  /**
   * Encode audio buffer to 16-bit PCM WAV format
   */
  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numChannels * 2; // 2 bytes per sample (16-bit)
    
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
    view.setUint16(32, numChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Write PCM samples
    const channelData = audioBuffer.getChannelData(0);
    let offset = 44;
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    console.log('[AUDIO-PREPROCESS] Encoded to 16-bit PCM WAV');
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.audioContext.close();
  }
}

/**
 * Helper function to preprocess audio file
 */
export async function preprocessAudioFile(file: File): Promise<Blob> {
  const preprocessor = new AudioPreprocessor();
  try {
    return await preprocessor.preprocessAudio(file);
  } finally {
    preprocessor.dispose();
  }
}
