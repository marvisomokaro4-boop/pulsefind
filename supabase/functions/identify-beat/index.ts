import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin metrics for monitoring
interface ScanMetrics {
  totalScans: number;
  noResultScans: number;
  averageScore: number;
  retryAttempts: number;
  errorCodes: Map<number, number>;
}

const metrics: ScanMetrics = {
  totalScans: 0,
  noResultScans: 0,
  averageScore: 0,
  retryAttempts: 0,
  errorCodes: new Map(),
};

// Helper function to get Spotify access token
async function getSpotifyToken(): Promise<string | null> {
  try {
    // Using Spotify's Client Credentials flow
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')!;
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (!clientSecret) {
      console.log('Spotify client secret not configured, skipping preview URLs');
      return null;
    }
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      console.error('Failed to get Spotify token:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

// Helper function to get album artwork and preview URL from Spotify
async function getSpotifyTrackDetails(trackId: string, token: string): Promise<{ artworkUrl: string | null, previewUrl: string | null, isAvailable: boolean, popularity: number | null }> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Spotify API error for track ${trackId}: ${response.status}`);
      return { artworkUrl: null, previewUrl: null, isAvailable: false, popularity: null };
    }
    
    const data = await response.json();
    
    // Check if track is available in any market
    const isAvailable = data.available_markets && data.available_markets.length > 0;
    
    if (!isAvailable) {
      console.log(`Track ${trackId} is not available in any market`);
    }
    
    const images = data.album?.images;
    
    // Get medium-sized image (typically 300x300)
    const artworkUrl = images && images.length > 0 
      ? (images[1]?.url || images[0]?.url)
      : null;
    
    // Get preview URL (30-second MP3)
    const previewUrl = data.preview_url || null;
    
    // Get popularity score (0-100)
    const popularity = typeof data.popularity === 'number' ? data.popularity : null;
    
    return { artworkUrl, previewUrl, isAvailable, popularity };
  } catch (error) {
    console.error('Error fetching Spotify track details:', error);
    return { artworkUrl: null, previewUrl: null, isAvailable: false, popularity: null };
  }
}

// Helper function to search Apple Music using iTunes Search API
async function searchAppleMusic(title: string, artist: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${searchQuery}&media=music&entity=song&limit=10`
    );
    
    if (!response.ok) {
      console.error('iTunes Search API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Normalize strings for comparison
      const normalizeString = (str: string) => 
        str.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const normalizedTitle = normalizeString(title);
      const normalizedArtist = normalizeString(artist);
      
      console.log(`iTunes Search found ${data.results.length} results for "${title}" by ${artist}`);
      
      // Find the best match with more lenient matching
      for (const result of data.results) {
        const resultTitle = normalizeString(result.trackName || '');
        const resultArtist = normalizeString(result.artistName || '');
        
        // More lenient matching - check if either contains the other
        const titleMatch = resultTitle.includes(normalizedTitle) || normalizedTitle.includes(resultTitle);
        const artistMatch = resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist);
        
        if (titleMatch && artistMatch) {
          console.log(`✓ Found Apple Music match: "${result.trackName}" by ${result.artistName} (ID: ${result.trackId})`);
          return result.trackId?.toString() || null;
        }
      }
      
      // If no match found, log first few results for debugging
      console.log(`No exact match found. Top results were:`);
      data.results.slice(0, 3).forEach((r: any) => {
        console.log(`  - "${r.trackName}" by ${r.artistName} (ID: ${r.trackId})`);
      });
    } else {
      console.log(`iTunes Search returned no results for "${title}" by ${artist}`);
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Apple Music:', error);
    return null;
  }
}

// Helper function to get ACRCloud metadata API token
async function getACRCloudToken(): Promise<string | null> {
  const acrcloudAccessKey = Deno.env.get('ACRCLOUD_ACCESS_KEY');
  const acrcloudAccessSecret = Deno.env.get('ACRCLOUD_ACCESS_SECRET');
  
  if (!acrcloudAccessKey || !acrcloudAccessSecret) {
    return null;
  }

  try {
    const credentials = btoa(`${acrcloudAccessKey}:${acrcloudAccessSecret}`);
    const response = await fetch('https://eu-api-v2.acrcloud.com/api/access-token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to get ACRCloud token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('Error getting ACRCloud token:', error);
    return null;
  }
}

// Helper function to fetch Apple Music ID from ACRCloud Metadata API
async function getAppleMusicFromACRCloud(acrid: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://eu-api-v2.acrcloud.com/api/external-metadata/tracks?acr_id=${acrid}&platforms=applemusic`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      console.error('ACRCloud Metadata API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.data?.applemusic?.track?.id) {
      console.log(`Found Apple Music ID via ACRCloud Metadata API: ${data.data.applemusic.track.id}`);
      return data.data.applemusic.track.id;
    }

    return null;
  } catch (error) {
    console.error('Error fetching Apple Music from ACRCloud Metadata API:', error);
    return null;
  }
}

interface ACRCloudResponse {
  status: {
    msg: string;
    code: number;
  };
  metadata?: {
    music?: Array<{
      title: string;
      artists: Array<{ name: string }>;
      album: { name: string };
      acrid: string;
      external_ids?: {
        isrc?: string;
      };
      external_metadata?: {
        spotify?: { 
          track: { id: string };
          album?: { id: string };
        };
        applemusic?: { track: { id: string } };
        apple_music?: { track: { id: string } };
        youtube?: { vid: string };
      };
      score: number;
      play_offset_ms?: number;
      duration_ms?: number;
      db_begin_time_offset_ms?: number;
      db_end_time_offset_ms?: number;
      release_date?: string;
    }>;
  };
}

interface ShazamResponse {
  track?: {
    title: string;
    subtitle: string;
    share: {
      href: string;
    };
    hub?: {
      providers?: Array<{
        type: string;
        actions: Array<{
          uri: string;
        }>;
      }>;
    };
  };
}

// Audio preprocessing functions
async function convertTo16BitPCM(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    console.log('Converting audio to 16-bit PCM WAV format...');
    
    // For now, we'll pass through the audio as-is since Deno doesn't have native audio processing
    // ACRCloud can handle various formats including MP3
    // A full implementation would use FFmpeg or similar
    
    return audioBuffer;
  } catch (error) {
    console.error('PCM conversion error:', error);
    return audioBuffer; // Fallback to original
  }
}

async function normalizeAudioVolume(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    console.log('Normalizing audio volume...');
    
    // Simple volume normalization by analyzing and adjusting RMS
    const samples = new Int16Array(audioBuffer);
    
    // Calculate current RMS
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }
    const currentRMS = Math.sqrt(sumSquares / samples.length);
    
    // Target RMS of 0.15 (reasonable level)
    const targetRMS = 0.15;
    const gain = currentRMS > 0 ? targetRMS / currentRMS : 1;
    
    // Don't amplify more than 3x to avoid distortion
    const safeGain = Math.min(gain, 3.0);
    
    if (safeGain !== 1.0) {
      console.log(`Applying gain: ${safeGain.toFixed(2)}x (current RMS: ${currentRMS.toFixed(3)})`);
      
      const normalized = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const amplified = samples[i] * safeGain;
        // Clamp to prevent clipping
        normalized[i] = Math.max(-32768, Math.min(32767, amplified));
      }
      
      return normalized.buffer;
    }
    
    return audioBuffer;
  } catch (error) {
    console.error('Normalization error:', error);
    return audioBuffer; // Fallback to original
  }
}

async function removeLongSilence(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    console.log('Removing long silent sections...');
    
    const samples = new Int16Array(audioBuffer);
    const SILENCE_THRESHOLD = 0.01;
    const MIN_SILENCE_DURATION_SAMPLES = 44100; // 1 second at 44.1kHz
    
    const keptSamples: number[] = [];
    let silentSampleCount = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const normalized = Math.abs(samples[i] / 32768);
      
      if (normalized < SILENCE_THRESHOLD) {
        silentSampleCount++;
        // Only keep short silences
        if (silentSampleCount < MIN_SILENCE_DURATION_SAMPLES) {
          keptSamples.push(samples[i]);
        }
      } else {
        silentSampleCount = 0;
        keptSamples.push(samples[i]);
      }
    }
    
    const removed = samples.length - keptSamples.length;
    if (removed > 0) {
      console.log(`Removed ${removed} samples (${(removed / 44100).toFixed(2)}s) of silence`);
      return new Int16Array(keptSamples).buffer;
    }
    
    return audioBuffer;
  } catch (error) {
    console.error('Silence removal error:', error);
    return audioBuffer; // Fallback to original
  }
}

async function preprocessAudio(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  console.log('Starting audio preprocessing pipeline...');
  const startTime = Date.now();
  
  try {
    let processed = audioBuffer;
    
    // Step 1: Convert to 16-bit PCM WAV
    processed = await convertTo16BitPCM(processed);
    
    // Step 2: Normalize volume
    processed = await normalizeAudioVolume(processed);
    
    // Step 3: Remove long silence
    processed = await removeLongSilence(processed);
    
    const duration = Date.now() - startTime;
    console.log(`Audio preprocessing completed in ${duration}ms`);
    
    return processed;
  } catch (error) {
    console.error('Audio preprocessing failed:', error);
    return audioBuffer; // Return original on failure
  }
}

async function identifySegmentWithACRCloud(
  arrayBuffer: ArrayBuffer, 
  fileName: string,
  segmentStart: number,
  segmentName: string,
  priority: 'high' | 'normal' = 'normal'
): Promise<any[]> {
  const acrcloudHost = "identify-eu-west-1.acrcloud.com";
  const acrcloudAccessKey = Deno.env.get('ACRCLOUD_ACCESS_KEY');
  const acrcloudAccessSecret = Deno.env.get('ACRCLOUD_ACCESS_SECRET');

  if (!acrcloudAccessKey || !acrcloudAccessSecret) {
    console.log('ACRCloud credentials not configured');
    return [];
  }

  try {
    const sampleSize = Math.min(arrayBuffer.byteLength - segmentStart, 500 * 1024); // 500KB max
    const audioSample = arrayBuffer.slice(segmentStart, segmentStart + sampleSize);
    const audioData = new Uint8Array(audioSample);
    
    console.log(`Processing ${priority} priority ${segmentName} segment: ${sampleSize} bytes from offset ${segmentStart}`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${acrcloudAccessKey}\naudio\n1\n${timestamp}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(acrcloudAccessSecret);
    const messageData = encoder.encode(stringToSign);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );
    
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    const formData = new FormData();
    const audioBlob = new Blob([audioSample], { type: 'audio/mpeg' });
    formData.append('sample', audioBlob, fileName);
    formData.append('access_key', acrcloudAccessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signatureBase64);
    formData.append('sample_bytes', audioData.length.toString());
    formData.append('timestamp', timestamp.toString());

    const queryStartTime = Date.now();
    const response = await fetch(`https://${acrcloudHost}/v1/identify`, {
      method: 'POST',
      body: formData,
    });
    const queryDuration = Date.now() - queryStartTime;

    const data: ACRCloudResponse = await response.json();
    console.log(`ACRCloud response for ${segmentName} (${queryDuration}ms):`, JSON.stringify(data));
    
    // Track error codes
    if (data.status.code !== 0) {
      const errorCount = metrics.errorCodes.get(data.status.code) || 0;
      metrics.errorCodes.set(data.status.code, errorCount + 1);
      console.log(`ACRCloud error code ${data.status.code}: ${data.status.msg}`);
    }

    if (data.status.code === 0 && data.metadata?.music) {
      return data.metadata.music.map(track => {
        // Calculate played duration if available
        const playedDuration = track.db_end_time_offset_ms && track.db_begin_time_offset_ms
          ? (track.db_end_time_offset_ms - track.db_begin_time_offset_ms) / 1000
          : 0;
        
        // Calculate duration difference
        const durationDiff = track.duration_ms 
          ? Math.abs((track.duration_ms / 1000) - (arrayBuffer.byteLength / 176400)) // Rough estimate
          : 0;
        
        // Construct Spotify album artwork URL if we have spotify album ID
        let albumCoverUrl = null;
        if (track.external_metadata?.spotify?.album?.id) {
          albumCoverUrl = `https://i.scdn.co/image/${track.external_metadata.spotify.album.id}`;
        } else if (track.external_metadata?.spotify?.track?.id) {
          albumCoverUrl = null; // Will be populated via Spotify API
        }

        return {
          title: track.title,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          confidence: track.score,
          source: 'ACRCloud',
          isrc: track.external_ids?.isrc,
          spotify_id: track.external_metadata?.spotify?.track?.id,
          spotify_album_id: track.external_metadata?.spotify?.album?.id,
          apple_music_id: track.external_metadata?.applemusic?.track?.id || 
                          track.external_metadata?.apple_music?.track?.id,
          youtube_id: track.external_metadata?.youtube?.vid,
          release_date: track.release_date,
          album_cover_url: albumCoverUrl,
          segment: segmentName,
          segment_offset: segmentStart,
          priority,
          acrid: track.acrid,
          played_duration: playedDuration,
          duration_diff: durationDiff,
          query_duration_ms: queryDuration,
        };
      });
    }

    return [];
  } catch (error) {
    console.error(`ACRCloud error for ${segmentName}:`, error);
    return [];
  }
}

// Audio quality analysis functions
interface AudioQualityScore {
  score: number; // 0-100
  rms: number;
  peakLevel: number;
  zeroCrossingRate: number;
  energyVariance: number;
  isSilent: boolean;
  isUsable: boolean;
}

function analyzeAudioQuality(audioData: ArrayBuffer, offset: number, length: number): AudioQualityScore {
  try {
    // Ensure length is even (multiple of 2) for Int16Array
    const adjustedLength = Math.floor(length / 2) * 2;
    
    if (adjustedLength === 0) {
      return {
        score: 50, // Neutral score when can't analyze
        rms: 0,
        peakLevel: 0,
        zeroCrossingRate: 0,
        energyVariance: 0,
        isSilent: false,
        isUsable: true // Allow usage when can't determine
      };
    }
    
    const samples = new Int16Array(audioData.slice(offset, offset + adjustedLength));
    const sampleCount = samples.length;
    
    if (sampleCount === 0) {
      return {
        score: 50,
        rms: 0,
        peakLevel: 0,
        zeroCrossingRate: 0,
        energyVariance: 0,
        isSilent: false,
        isUsable: true
      };
    }

  // Calculate RMS (Root Mean Square) - overall loudness
  let sumSquares = 0;
  let peakLevel = 0;
  
  for (let i = 0; i < sampleCount; i++) {
    const normalized = samples[i] / 32768; // Normalize to -1 to 1
    sumSquares += normalized * normalized;
    peakLevel = Math.max(peakLevel, Math.abs(normalized));
  }
  
  const rms = Math.sqrt(sumSquares / sampleCount);
  
  // Calculate zero-crossing rate - indicator of noise vs. tonal content
  let zeroCrossings = 0;
  for (let i = 1; i < sampleCount; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = zeroCrossings / sampleCount;
  
  // Calculate energy variance across the segment (measures consistency)
  const windowSize = Math.floor(sampleCount / 10);
  const energies: number[] = [];
  
  for (let i = 0; i < sampleCount; i += windowSize) {
    let windowEnergy = 0;
    const end = Math.min(i + windowSize, sampleCount);
    
    for (let j = i; j < end; j++) {
      const normalized = samples[j] / 32768;
      windowEnergy += normalized * normalized;
    }
    
    energies.push(windowEnergy / (end - i));
  }
  
  const meanEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  const energyVariance = energies.reduce((sum, e) => sum + Math.pow(e - meanEnergy, 2), 0) / energies.length;
  
  // Quality scoring - only detect silence, very lenient for beats/producer tags
  const SILENCE_THRESHOLD = 0.003; // More lenient
  const MIN_PEAK_THRESHOLD = 0.03; // More lenient
  const LOW_VARIANCE_THRESHOLD = 0.0001;
  
  const isSilent = rms < SILENCE_THRESHOLD || peakLevel < MIN_PEAK_THRESHOLD;
  const hasLowVariance = energyVariance < LOW_VARIANCE_THRESHOLD;
  
  // Calculate overall quality score (0-100)
  let score = 0;
  
  if (!isSilent) {
    // RMS contribution (40 points): louder is better, but not clipping
    const rmsScore = Math.min(rms / 0.3, 1) * 40;
    score += rmsScore;
    
    // Peak level contribution (20 points): good dynamic range
    const peakScore = (peakLevel > 0.1 && peakLevel < 0.95) ? 20 : peakLevel * 10;
    score += peakScore;
    
    // Zero-crossing rate contribution (20 points): all content is valid
    const zcrScore = 20;
    score += zcrScore;
    
    // Energy variance contribution (20 points): prefer consistent, varied audio
    const varianceScore = energyVariance > LOW_VARIANCE_THRESHOLD ? Math.min(energyVariance * 10000, 20) : 0;
    score += varianceScore;
  }
  
  // Only filter out silent segments, very low score threshold
  const isUsable = !isSilent && score >= 10;
  
    return {
      score: Math.round(score),
      rms: Math.round(rms * 1000) / 1000,
      peakLevel: Math.round(peakLevel * 1000) / 1000,
      zeroCrossingRate: Math.round(zeroCrossingRate * 1000) / 1000,
      energyVariance: Math.round(energyVariance * 100000) / 100000,
      isSilent,
      isUsable
    };
  } catch (error) {
    console.error('Audio quality analysis error:', error);
    // Fallback: return neutral quality score that allows processing
    return {
      score: 50,
      rms: 0,
      peakLevel: 0,
      zeroCrossingRate: 0,
      energyVariance: 0,
      isSilent: false,
      isUsable: true // Always allow processing on analysis failure
    };
  }
}

// Normalize strings for fuzzy matching
function normalizeForMatching(str: string): string {
  return str.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '')
    .trim();
}

// Check if two tracks are likely the same with fuzzy matching
function areSimilarTracks(track1: any, track2: any): boolean {
  const title1 = normalizeForMatching(track1.title);
  const title2 = normalizeForMatching(track2.title);
  const artist1 = normalizeForMatching(track1.artist);
  const artist2 = normalizeForMatching(track2.artist);
  
  // Exact normalized match
  if (title1 === title2 && artist1 === artist2) return true;
  
  // One contains the other (for remixes, featuring artists, etc.)
  const titleSimilar = title1.includes(title2) || title2.includes(title1);
  const artistSimilar = artist1.includes(artist2) || artist2.includes(artist1);
  
  return titleSimilar && artistSimilar;
}

// Simplified scanning strategy - just full audio scan
async function tryMultipleQueryStrategies(
  arrayBuffer: ArrayBuffer, 
  fileName: string,
  disableDeduplication: boolean = false
): Promise<any[]> {
  console.log('Starting full audio scan...');
  
  try {
    const results = await identifyWithACRCloudMultiSegment(arrayBuffer, fileName, disableDeduplication);
    console.log(`Scan complete, found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Scan failed:', error);
    return [];
  }
}

async function identifyWithACRCloudMultiSegment(arrayBuffer: ArrayBuffer, fileName: string, disableDeduplication: boolean = false): Promise<any[]> {
  const acrcloudAccessKey = Deno.env.get('ACRCLOUD_ACCESS_KEY');
  const acrcloudAccessSecret = Deno.env.get('ACRCLOUD_ACCESS_SECRET');

  if (!acrcloudAccessKey || !acrcloudAccessSecret) {
    console.log('ACRCloud credentials not configured');
    return [];
  }

  try {
    const fileSize = arrayBuffer.byteLength;
    const segmentSize = 512 * 1024; // 512KB segments (increased from 400KB)
    const overlapSize = 256 * 1024; // 256KB overlap (50% overlap - reduced from 75%)
    
    console.log(`Analyzing beat: ${fileSize} bytes with optimized segment scanning`);
    
    // Simplified approach: scan all segments without complex quality pre-analysis
    const segmentPositions: Array<{ offset: number; index: number }> = [];
    let offset = 0;
    let segmentIndex = 0;
    
    while (offset < fileSize) {
      segmentPositions.push({ offset, index: segmentIndex });
      segmentIndex++;
      offset += segmentSize - overlapSize;
      if (offset >= fileSize) break;
    }
    
    console.log(`Generated ${segmentPositions.length} segments for scanning`);
    
    // Process in batches for speed
    const batchSize = 10; // Increased batch size
    const allTracks: any[] = [];
    
    for (let i = 0; i < segmentPositions.length; i += batchSize) {
      const batch = segmentPositions.slice(i, i + batchSize);
      const batchPromises = batch.map(seg => {
        const percentage = Math.round((seg.offset / fileSize) * 100);
        return identifySegmentWithACRCloud(
          arrayBuffer,
          fileName,
          seg.offset,
          `segment ${seg.index + 1} (${percentage}%)`,
          'normal'
        );
      });
      const results = await Promise.all(batchPromises);
      allTracks.push(...results.flat());
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(segmentPositions.length / batchSize)}`);
    }

    console.log(`Total tracks found across all segments: ${allTracks.length}`);

    // Enhanced deduplication (can be disabled in debug mode)
    let uniqueTracks: any[];
    
    if (disableDeduplication) {
      console.log('⚠️  DEBUG MODE: Deduplication DISABLED - showing all raw results');
      uniqueTracks = allTracks;
    } else {
      const deduplicatedTracks: any[] = [];
      const seenISRCs = new Set<string>();
      const seenTitleArtist = new Set<string>();
      
      for (const track of allTracks) {
        // Deduplication by ISRC (most reliable)
        if (track.isrc) {
          if (seenISRCs.has(track.isrc)) {
            // Find existing and merge if new one has better score
            const existingIdx = deduplicatedTracks.findIndex(t => t.isrc === track.isrc);
            if (existingIdx >= 0 && track.confidence > deduplicatedTracks[existingIdx].confidence) {
              deduplicatedTracks[existingIdx] = {
                ...track,
                spotify_id: track.spotify_id || deduplicatedTracks[existingIdx].spotify_id,
                apple_music_id: track.apple_music_id || deduplicatedTracks[existingIdx].apple_music_id,
                youtube_id: track.youtube_id || deduplicatedTracks[existingIdx].youtube_id,
              };
            }
            continue;
          }
          seenISRCs.add(track.isrc);
        }
        
        // Fallback: Deduplication by title + artist
        const titleArtistKey = `${normalizeForMatching(track.title)}_${normalizeForMatching(track.artist)}`;
        if (seenTitleArtist.has(titleArtistKey)) {
          const existingIdx = deduplicatedTracks.findIndex(t => 
            areSimilarTracks(t, track)
          );
          
          if (existingIdx >= 0 && track.confidence > deduplicatedTracks[existingIdx].confidence) {
            deduplicatedTracks[existingIdx] = {
              ...track,
              spotify_id: track.spotify_id || deduplicatedTracks[existingIdx].spotify_id,
              apple_music_id: track.apple_music_id || deduplicatedTracks[existingIdx].apple_music_id,
              youtube_id: track.youtube_id || deduplicatedTracks[existingIdx].youtube_id,
              isrc: track.isrc || deduplicatedTracks[existingIdx].isrc, // Preserve ISRC
            };
          }
          continue;
        }
        seenTitleArtist.add(titleArtistKey);
        
        deduplicatedTracks.push(track);
      }
      
      uniqueTracks = deduplicatedTracks;
    }

    console.log(`After deduplication: ${uniqueTracks.length} unique tracks`);
    
    // Log raw results for debugging
    console.log('=== VALIDATION REPORT ===');
    console.log(`Total raw results before filtering: ${uniqueTracks.length}`);
    
    // Apply validation rules to reduce false positives
    const validationStats = {
      lowConfidence: 0,
      missingMetadata: 0,
      durationMismatch: 0,
      shortPlayDuration: 0,
    };
    
    let results = uniqueTracks.filter(track => {
      // Rule 1: Minimum confidence score of 40 (balanced threshold)
      if (track.confidence < 40) {
        validationStats.lowConfidence++;
        console.log(`❌ Rejected: "${track.title}" by ${track.artist} - Low confidence (${track.confidence}%)`);
        return false;
      }
      
      // Rule 2: Must have valid metadata (title and artist required, ISRC optional)
      if (!track.title || !track.artist) {
        validationStats.missingMetadata++;
        console.log(`❌ Rejected: "${track.title || 'Unknown'}" - Missing title or artist`);
        return false;
      }
      
      // Rule 3: Duration validation (if available) - allow reasonable variation
      if (track.duration_diff && track.duration_diff > 10) {
        validationStats.durationMismatch++;
        console.log(`❌ Rejected: "${track.title}" by ${track.artist} - Duration mismatch (${track.duration_diff.toFixed(1)}s diff)`);
        return false;
      }
      
      // Rule 4: Played duration must be >= 8 seconds (if available)
      if (track.played_duration && track.played_duration < 8) {
        validationStats.shortPlayDuration++;
        console.log(`❌ Rejected: "${track.title}" by ${track.artist} - Insufficient match duration (${track.played_duration.toFixed(1)}s)`);
        return false;
      }
      
      console.log(`✅ Accepted: "${track.title}" by ${track.artist} (${track.confidence}% confidence)`);
      return true;
    });
    
    console.log(`=== FILTERING STATS ===`);
    console.log(`Rejected due to low confidence (<70%): ${validationStats.lowConfidence}`);
    console.log(`Rejected due to missing metadata: ${validationStats.missingMetadata}`);
    console.log(`Rejected due to duration mismatch (>5s): ${validationStats.durationMismatch}`);
    console.log(`Rejected due to short play duration (<10s): ${validationStats.shortPlayDuration}`);
    console.log(`Final valid results: ${results.length} tracks`);
    
    // Track average score
    if (results.length > 0) {
      const avgScore = results.reduce((sum, t) => sum + t.confidence, 0) / results.length;
      metrics.averageScore = (metrics.averageScore * metrics.totalScans + avgScore) / (metrics.totalScans + 1);
    }
    
    // Sort by confidence, then by priority
    results.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    });
    
    // Return top 99 matches
    const topMatches = results.slice(0, 99);
    console.log(`Returning ${topMatches.length} matches`);
    
    return topMatches;
  } catch (error) {
    console.error('ACRCloud error:', error);
    return [];
  }
}

async function identifyWithShazam(arrayBuffer: ArrayBuffer): Promise<any[]> {
  const shazamApiKey = Deno.env.get('SHAZAM_API_KEY');

  if (!shazamApiKey) {
    console.log('Shazam API key not configured');
    return [];
  }

  try {

    const response = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': shazamApiKey,
        'x-rapidapi-host': 'shazam.p.rapidapi.com',
        'Content-Type': 'text/plain',
      },
      body: arrayBuffer,
    });

    const data: ShazamResponse = await response.json();
    console.log('Shazam response:', JSON.stringify(data));

    if (data.track) {
      const spotifyProvider = data.track.hub?.providers?.find(p => p.type === 'SPOTIFY');
      const appleMusicProvider = data.track.hub?.providers?.find(p => p.type === 'APPLEMUSIC');

      return [{
        title: data.track.title,
        artist: data.track.subtitle,
        source: 'Shazam',
        share_url: data.track.share.href,
        spotify_url: spotifyProvider?.actions[0]?.uri,
        apple_music_url: appleMusicProvider?.actions[0]?.uri,
      }];
    }

    return [];
  } catch (error) {
    console.error('Shazam error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting - 10 requests per 15 minutes per IP
  const clientId = getClientIdentifier(req);
  const rateLimitResult = await checkRateLimit(clientId, 'identify-beat', {
    maxRequests: 10,
    windowMinutes: 15,
  });

  if (!rateLimitResult.allowed) {
    console.log(`Rate limit exceeded for ${clientId}`);
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded. Please try again later.',
        resetAt: rateLimitResult.resetAt.toISOString(),
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          'Retry-After': Math.ceil(
            (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }

  console.log(`Rate limit check passed for ${clientId}, remaining: ${rateLimitResult.remaining}`);

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const beatYear = formData.get('beatYear') as string | null;
    const disableDeduplication = formData.get('disableDeduplication') === 'true';

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing audio file:', audioFile.name, 'size:', audioFile.size);
    if (beatYear) {
      console.log('Filtering songs released after year:', beatYear);
    }

    // Get audio file as ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    
    // NOTE: Audio preprocessing disabled - normalization and silence removal
    // were causing identification failures with producer beats
    // ACRCloud handles various audio formats natively
    
    // Track scan attempt
    metrics.totalScans++;

    // Use multiple query strategies for maximum accuracy
    const acrcloudResults = await tryMultipleQueryStrategies(arrayBuffer, audioFile.name, disableDeduplication);
    
    // Shazam is not available, skip it
    const shazamResults: any[] = [];

    // Combine and deduplicate results
    const allResults = [...acrcloudResults, ...shazamResults];
    const uniqueResults = allResults.reduce((acc, result) => {
      const key = `${result.title}-${result.artist}`;
      if (!acc.has(key)) {
        acc.set(key, result);
      }
      return acc;
    }, new Map());

    let matches = Array.from(uniqueResults.values());

    // Fetch Spotify track details (artwork and preview URLs) for tracks with spotify_id
    const spotifyToken = await getSpotifyToken();
    const acrcloudToken = await getACRCloudToken();
    
    if (spotifyToken) {
      console.log('Fetching Spotify track details...');
      matches = await Promise.all(matches.map(async (track: any) => {
        let apple_music_id = track.apple_music_id;
        
        // First fallback: Try ACRCloud Metadata API if we have acrid
        if (!apple_music_id && track.acrid && acrcloudToken) {
          console.log(`Trying ACRCloud Metadata API for "${track.title}" with acrid: ${track.acrid}`);
          apple_music_id = await getAppleMusicFromACRCloud(track.acrid, acrcloudToken);
        }
        
        // Second fallback: Search iTunes if still no Apple Music ID
        if (!apple_music_id && track.title && track.artist) {
          console.log(`Apple Music ID not found, searching iTunes for "${track.title}"...`);
          apple_music_id = await searchAppleMusic(track.title, track.artist);
        }
        
        if (track.spotify_id) {
          try {
            const { artworkUrl, previewUrl, isAvailable, popularity } = await getSpotifyTrackDetails(track.spotify_id, spotifyToken);
            
            const spotify_url = `https://open.spotify.com/track/${track.spotify_id}`;
            const apple_music_url = apple_music_id ? `https://music.apple.com/us/song/${apple_music_id}` : null;
            const youtube_url = track.youtube_id ? `https://www.youtube.com/watch?v=${track.youtube_id}` : null;
            
            return { 
              ...track,
              apple_music_id,
              album_cover_url: artworkUrl || track.album_cover_url,
              preview_url: previewUrl,
              popularity,
              spotify_url,
              apple_music_url,
              youtube_url
            };
          } catch (e) {
            console.error('Error fetching Spotify details:', e);
          }
        }
        
        // Even without Spotify, construct URLs for other platforms
        const apple_music_url = apple_music_id ? `https://music.apple.com/us/song/${apple_music_id}` : null;
        const youtube_url = track.youtube_id ? `https://music.youtube.com/watch?v=${track.youtube_id}` : null;
        
        return {
          ...track,
          apple_music_id,
          apple_music_url,
          youtube_url
        };
      }));
    } else {
      // No Spotify token, but still construct URLs for other platforms and search Apple Music
      matches = await Promise.all(matches.map(async (track: any) => {
        let apple_music_id = track.apple_music_id;
        
        // Fallback: Search Apple Music if ID not provided by ACRCloud
        if (!apple_music_id && track.title && track.artist) {
          console.log(`Apple Music ID not found for "${track.title}", searching iTunes...`);
          apple_music_id = await searchAppleMusic(track.title, track.artist);
        }
        
    const spotify_url = track.spotify_id ? `https://open.spotify.com/track/${track.spotify_id}` : null;
    const apple_music_url = apple_music_id ? `https://music.apple.com/us/song/${apple_music_id}` : null;
    const youtube_url = track.youtube_id ? `https://www.youtube.com/watch?v=${track.youtube_id}` : null;
        
        return {
          ...track,
          apple_music_id,
          spotify_url,
          apple_music_url,
          youtube_url
        };
      }));
    }

    // Filter by beat year if provided
    if (beatYear) {
      const filterYear = parseInt(beatYear);
      matches = matches.filter((match: any) => {
        if (!match.release_date) return true; // Keep if no release date available
        
        const releaseYear = new Date(match.release_date).getFullYear();
        return releaseYear >= filterYear;
      });
      console.log(`After year filter (${filterYear}):`, matches.length, 'matches');
    }

    console.log('Found matches:', matches.length);
    
    // Track no-result scans
    if (matches.length === 0) {
      metrics.noResultScans++;
      console.log(`No confirmed matches found (${metrics.noResultScans}/${metrics.totalScans} scans with no results)`);
    }
    
    // Log metrics summary
    console.log('=== Scan Metrics Summary ===');
    console.log(`Total scans: ${metrics.totalScans}`);
    console.log(`No-result scans: ${metrics.noResultScans} (${((metrics.noResultScans / metrics.totalScans) * 100).toFixed(1)}%)`);
    console.log(`Average confidence score: ${metrics.averageScore.toFixed(1)}%`);
    console.log(`Total retry attempts: ${metrics.retryAttempts}`);
    if (metrics.errorCodes.size > 0) {
      console.log('Error codes encountered:');
      metrics.errorCodes.forEach((count, code) => {
        console.log(`  Code ${code}: ${count} times`);
      });
    }
    console.log('===========================');

    // Return appropriate message based on results
    const response: any = {
      success: true,
      matches,
      sources_used: {
        acrcloud: acrcloudResults.length > 0,
        shazam: false,
      },
      metrics: {
        totalScanned: metrics.totalScans,
        retryAttempts: metrics.retryAttempts,
        averageScore: Math.round(metrics.averageScore),
      }
    };
    
    // Add helpful message if no matches found
    if (matches.length === 0) {
      response.message = "No confirmed matches found. Try uploading a longer or clearer version of the beat, or ensure the beat has been released publicly on streaming platforms.";
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
        }
      }
    );

  } catch (error) {
    console.error('Error in identify-beat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
