/**
 * Dynamic Segmentation Module
 * Detects high-energy regions and unique patterns for intelligent segment selection
 */

export interface AudioSegment {
  offset: number;
  duration: number;
  energy: number;
  uniqueness: number;
  name: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Analyze audio and select optimal segments based on energy and uniqueness
 * Returns segments prioritized by their likelihood to produce strong matches
 */
export function selectDynamicSegments(
  audioBuffer: ArrayBuffer,
  targetSegmentCount: number,
  deepScan: boolean = false
): AudioSegment[] {
  // Ensure buffer is properly aligned for Float32Array (multiple of 4 bytes)
  const byteLength = audioBuffer.byteLength;
  const alignedLength = Math.floor(byteLength / 4) * 4;
  
  if (alignedLength === 0) {
    throw new Error('Audio buffer too small for analysis');
  }
  
  const alignedBuffer = alignedLength === byteLength 
    ? audioBuffer 
    : audioBuffer.slice(0, alignedLength);
    
  const samples = new Float32Array(alignedBuffer);
  const fileSize = audioBuffer.byteLength;
  
  console.log('\n🎯 DYNAMIC SEGMENT ANALYSIS');
  console.log(`Audio samples: ${samples.length}, File size: ${fileSize} bytes`);
  
  // Analyze audio characteristics
  const analysis = analyzeAudioCharacteristics(samples);
  console.log(`Energy profile: min=${analysis.minEnergy.toFixed(3)}, max=${analysis.maxEnergy.toFixed(3)}, avg=${analysis.avgEnergy.toFixed(3)}`);
  console.log(`Detected ${analysis.peaks.length} energy peaks`);
  
  // Select segments based on characteristics
  const segments = deepScan
    ? selectSegmentsDeepScan(fileSize, analysis, targetSegmentCount)
    : selectSegmentsStandard(fileSize, analysis, targetSegmentCount);
  
  // Sort by priority (high → medium → low) and energy (highest first within each priority)
  segments.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.energy - a.energy;
  });
  
  console.log(`Selected ${segments.length} dynamic segments:`);
  segments.forEach(seg => {
    console.log(`  ${seg.name}: energy=${seg.energy.toFixed(2)}, uniqueness=${seg.uniqueness.toFixed(2)}, priority=${seg.priority}`);
  });
  
  return segments;
}

interface AudioAnalysis {
  minEnergy: number;
  maxEnergy: number;
  avgEnergy: number;
  peaks: number[]; // Sample indices of energy peaks
  valleys: number[]; // Sample indices of low energy regions
  spectralVariance: number[]; // Uniqueness measure per region
}

/**
 * Analyze audio to find peaks, valleys, and spectral characteristics
 */
function analyzeAudioCharacteristics(samples: Float32Array): AudioAnalysis {
  const windowSize = 44100; // 1 second at 44.1kHz
  const hopSize = 22050; // 0.5 second overlap
  
  const energies: number[] = [];
  const spectralVariances: number[] = [];
  
  // Compute energy and spectral variance for each window
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    const window = samples.slice(i, i + windowSize);
    
    // RMS energy
    let sumSquares = 0;
    for (let j = 0; j < window.length; j++) {
      sumSquares += window[j] * window[j];
    }
    const energy = Math.sqrt(sumSquares / window.length);
    energies.push(energy);
    
    // Spectral variance (measure of uniqueness)
    const variance = computeSpectralVariance(window);
    spectralVariances.push(variance);
  }
  
  // Find peaks (local maxima)
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      // Convert to sample index
      peaks.push(i * hopSize);
    }
  }
  
  // Find valleys (local minima)
  const valleys: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] < energies[i - 1] && energies[i] < energies[i + 1]) {
      valleys.push(i * hopSize);
    }
  }
  
  const minEnergy = Math.min(...energies);
  const maxEnergy = Math.max(...energies);
  const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  
  return {
    minEnergy,
    maxEnergy,
    avgEnergy,
    peaks,
    valleys,
    spectralVariance: spectralVariances
  };
}

/**
 * Compute spectral variance for a window (measure of uniqueness)
 */
function computeSpectralVariance(window: Float32Array): number {
  const numBands = 32;
  const bandSize = Math.floor(window.length / numBands);
  const bandEnergies: number[] = [];
  
  // Calculate energy in each frequency band
  for (let b = 0; b < numBands; b++) {
    const start = b * bandSize;
    const end = Math.min(start + bandSize, window.length);
    
    let bandEnergy = 0;
    for (let i = start; i < end; i++) {
      bandEnergy += window[i] * window[i];
    }
    bandEnergies.push(bandEnergy);
  }
  
  // Calculate variance across bands
  const mean = bandEnergies.reduce((a, b) => a + b, 0) / bandEnergies.length;
  let variance = 0;
  for (const energy of bandEnergies) {
    variance += (energy - mean) * (energy - mean);
  }
  variance /= bandEnergies.length;
  
  return variance;
}

/**
 * Select segments for standard scan (4 segments)
 */
function selectSegmentsStandard(
  fileSize: number,
  analysis: AudioAnalysis,
  targetCount: number
): AudioSegment[] {
  const segments: AudioSegment[] = [];
  
  // Always include full audio as first segment (highest priority)
  segments.push({
    offset: 0,
    duration: fileSize,
    energy: analysis.avgEnergy,
    uniqueness: 1.0,
    name: 'FULL AUDIO (comprehensive)',
    priority: 'high'
  });
  
  // Find highest energy peak (usually the drop/hook)
  if (analysis.peaks.length > 0) {
    const peakEnergies = analysis.peaks.map(peakIdx => {
      const windowIdx = Math.floor(peakIdx / 22050);
      return analysis.spectralVariance[windowIdx] || 0;
    });
    const maxPeakIdx = peakEnergies.indexOf(Math.max(...peakEnergies));
    const bestPeakOffset = Math.floor((analysis.peaks[maxPeakIdx] / 44100) * (fileSize / 1024)); // Rough byte offset
    
    segments.push({
      offset: Math.max(0, bestPeakOffset),
      duration: 60 * 1024, // ~60 seconds
      energy: peakEnergies[maxPeakIdx],
      uniqueness: analysis.spectralVariance[Math.floor(analysis.peaks[maxPeakIdx] / 22050)] || 0,
      name: 'PEAK DROP (highest energy)',
      priority: 'high'
    });
  }
  
  // Add middle segment (usually verse/hook transition)
  segments.push({
    offset: Math.floor(fileSize * 0.4),
    duration: 40 * 1024, // ~40 seconds
    energy: analysis.avgEnergy,
    uniqueness: 0.7,
    name: 'MID SECTION (40%)',
    priority: 'medium'
  });
  
  // Add late segment (outro/final drop)
  segments.push({
    offset: Math.floor(fileSize * 0.75),
    duration: 30 * 1024, // ~30 seconds
    energy: analysis.avgEnergy * 0.8,
    uniqueness: 0.6,
    name: 'LATE SECTION (75%)',
    priority: 'medium'
  });
  
  return segments.slice(0, targetCount);
}

/**
 * Select segments for deep scan (7-8 segments)
 */
function selectSegmentsDeepScan(
  fileSize: number,
  analysis: AudioAnalysis,
  targetCount: number
): AudioSegment[] {
  const segments: AudioSegment[] = [];
  
  // Full audio (always first)
  segments.push({
    offset: 0,
    duration: fileSize,
    energy: analysis.avgEnergy,
    uniqueness: 1.0,
    name: 'FULL AUDIO (comprehensive)',
    priority: 'high'
  });
  
  // Find top 3 energy peaks
  const peakData = analysis.peaks.map(peakIdx => ({
    offset: Math.floor((peakIdx / 44100) * (fileSize / 1024)),
    sampleIdx: peakIdx,
    windowIdx: Math.floor(peakIdx / 22050),
    energy: analysis.spectralVariance[Math.floor(peakIdx / 22050)] || 0
  }));
  
  peakData.sort((a, b) => b.energy - a.energy);
  
  // Add top 3 peaks as high-priority segments
  for (let i = 0; i < Math.min(3, peakData.length); i++) {
    const peak = peakData[i];
    segments.push({
      offset: Math.max(0, peak.offset),
      duration: 60 * 1024,
      energy: peak.energy,
      uniqueness: analysis.spectralVariance[peak.windowIdx] || 0,
      name: `PEAK ${i + 1} (high energy)`,
      priority: 'high'
    });
  }
  
  // Add evenly-spaced segments for coverage
  const positions = [0.15, 0.35, 0.55, 0.75, 0.90];
  positions.forEach((pos, idx) => {
    segments.push({
      offset: Math.floor(fileSize * pos),
      duration: 40 * 1024,
      energy: analysis.avgEnergy * (1 - pos * 0.3), // Decrease priority for later segments
      uniqueness: 0.6,
      name: `COVERAGE ${Math.floor(pos * 100)}%`,
      priority: idx < 2 ? 'medium' : 'low'
    });
  });
  
  return segments.slice(0, targetCount);
}
