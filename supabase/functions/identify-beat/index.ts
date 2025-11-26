import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";
import { searchYouTube } from "../_shared/youtubeSearch.ts";
import { searchSpotify } from "../_shared/spotifySearch.ts";
import { generateAudioFingerprint, calculateHammingDistance } from "../_shared/audioFingerprint.ts";
import { selectDynamicSegments, type AudioSegment } from "../_shared/dynamicSegmentation.ts";
import { 
  analyzeBeatCharacteristics, 
  calculateAdaptiveThresholds 
} from "../_shared/adaptiveThresholds.ts";
import {
  logEnhancedAnalytics,
  analyzeSegmentPerformance,
  detectAnomalies,
  generateInsightsSummary,
  type ScanAnalytics,
  type SegmentAnalytics
} from "../_shared/analyticsEnhanced.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logging metrics
interface ScanMetrics {
  segmentsScanned: number;
  resultsBeforeFilter: number;
  resultsAfterFilter: number;
  confidenceScores: number[];
}

// Helper function to get Spotify access token
async function getSpotifyToken(): Promise<string | null> {
  try {
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
    const isAvailable = data.available_markets && data.available_markets.length > 0;
    const images = data.album?.images;
    const artworkUrl = images && images.length > 0 ? (images[1]?.url || images[0]?.url) : null;
    const previewUrl = data.preview_url || null;
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
      const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedTitle = normalizeString(title);
      const normalizedArtist = normalizeString(artist);
      
      for (const result of data.results) {
        const resultTitle = normalizeString(result.trackName || '');
        const resultArtist = normalizeString(result.artistName || '');
        const titleMatch = resultTitle.includes(normalizedTitle) || normalizedTitle.includes(resultTitle);
        const artistMatch = resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist);
        
        if (titleMatch && artistMatch) {
          return result.trackId?.toString() || null;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Apple Music:', error);
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
      release_date?: string;
    }>;
  };
}

/**
 * Simple ACRCloud identification for a single segment
 */
async function identifySegmentWithACRCloud(
  arrayBuffer: ArrayBuffer, 
  fileName: string,
  segmentStart: number,
  segmentName: string
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
    
    console.log(`Scanning ${segmentName}: ${sampleSize} bytes from offset ${segmentStart}`);
    
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
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
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
    
    if (data.status.code !== 0) {
      console.log(`⚠️  ${segmentName} - ACRCloud error ${data.status.code}: ${data.status.msg} (${queryDuration}ms)`);
      return [];
    }

    if (data.metadata?.music) {
      console.log(`✅ ${segmentName} - Found ${data.metadata.music.length} results (${queryDuration}ms)`);
      
      return data.metadata.music.map(track => {
        const confidence = track.score;
        const match_quality = confidence >= 85 ? 'high' : confidence >= 60 ? 'medium' : 'low';
        
        return {
          title: track.title,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          confidence: confidence,
          source: 'ACRCloud',
          isrc: track.external_ids?.isrc,
          spotify_id: track.external_metadata?.spotify?.track?.id,
          spotify_album_id: track.external_metadata?.spotify?.album?.id,
          apple_music_id: track.external_metadata?.applemusic?.track?.id || 
                          track.external_metadata?.apple_music?.track?.id,
          youtube_id: track.external_metadata?.youtube?.vid,
          release_date: track.release_date,
          segment: segmentName,
          match_quality: match_quality as 'high' | 'medium' | 'low',
        };
      });
    }

    console.log(`ℹ️  ${segmentName} - No results (${queryDuration}ms)`);
    return [];
  } catch (error) {
    console.error(`❌ ${segmentName} - ACRCloud error:`, error);
    return [];
  }
}

/**
 * Improved scanning with deep scan mode and caching
 */
async function identifyWithSimplifiedACRCloud(
  arrayBuffer: ArrayBuffer, 
  fileName: string,
  deepScan: boolean = false,
  matchingMode: 'loose' | 'strict' = 'loose',
  supabaseClient: any
): Promise<{ 
  results: any[], 
  metrics: ScanMetrics, 
  fromCache: boolean,
  platformStats: {
    acrcloud: {
      segmentsScanned: number,
      segmentsSuccessful: number,
      segmentsFailed: number
    }
  },
  analytics?: ScanAnalytics
}> {
  const scanStartTime = Date.now();
  const fileSize = arrayBuffer.byteLength;
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('\n=== ENHANCED AUDIO FINGERPRINT IDENTIFICATION ===');
  console.log(`Scan ID: ${scanId}`);
  console.log(`File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Deep Scan Mode: ${deepScan ? 'ENABLED (dynamic 7-8 segments)' : 'DISABLED (dynamic 4 segments)'}`);
  console.log(`Matching Mode: ${matchingMode.toUpperCase()}`);
  
  // PHASE 0: Analyze beat characteristics for adaptive thresholds
  console.log('\n🎼 PHASE 0: Beat Characteristics Analysis...');
  const preprocessStartTime = Date.now();
  
  let beatCharacteristics;
  let adaptiveThresholds;
  
  try {
    const samples = new Float32Array(arrayBuffer);
    const sampleRate = 44100; // Assume standard sample rate
    
    beatCharacteristics = analyzeBeatCharacteristics(samples, sampleRate);
    console.log(`Detected characteristics: tempo=${beatCharacteristics.tempo}BPM, energy=${beatCharacteristics.energy.toFixed(2)}, complexity=${beatCharacteristics.spectralComplexity.toFixed(2)}`);
    if (beatCharacteristics.genre) {
      console.log(`Genre hint: ${beatCharacteristics.genre}`);
    }
    
    adaptiveThresholds = calculateAdaptiveThresholds(beatCharacteristics, matchingMode);
    console.log(`${adaptiveThresholds.explanation}`);
  } catch (error) {
    console.error('❌ Failed to analyze beat characteristics, using default thresholds:', error);
    beatCharacteristics = { tempo: 120, energy: 0.5, spectralComplexity: 0.5 };
    adaptiveThresholds = {
      strict: 85,
      loose: 40,
      explanation: 'Using default thresholds (analysis failed)'
    };
  }
  
  const preprocessEndTime = Date.now();
  const preprocessingMs = preprocessEndTime - preprocessStartTime;
  
  // PHASE 1: Check local fingerprint database first for instant matches
  console.log('\n🔍 PHASE 1: Checking local fingerprint database...');
  try {
    const startTime = Date.now();
    const audioFeatures = await generateAudioFingerprint(arrayBuffer);
    const fingerprintTime = Date.now() - startTime;
    console.log(`✅ Generated binary fingerprint in ${fingerprintTime}ms (${audioFeatures.binaryFingerprint.length} chars)`);
    
    // Query all stored fingerprints
    const { data: storedFingerprints, error: dbError } = await supabaseClient
      .from('beat_fingerprints')
      .select('*');
    
    if (dbError) {
      console.error('❌ Database query error:', dbError);
    } else if (!storedFingerprints || storedFingerprints.length === 0) {
      console.log('📭 Local database is empty - no previous scans to match against');
    } else {
      console.log(`📊 Comparing against ${storedFingerprints.length} stored fingerprints...`);
      
      const MIN_CONFIDENCE = matchingMode === 'strict' ? 85 : 40;
      const minSimilarity = MIN_CONFIDENCE / 100; // Convert to 0-1 range
      const localMatches: any[] = [];
      
      for (const stored of storedFingerprints) {
        if (!stored.mfcc_features || typeof stored.mfcc_features !== 'string') continue;
        
        const storedFingerprint = stored.mfcc_features as string;
        const similarity = calculateHammingDistance(audioFeatures.binaryFingerprint, storedFingerprint);
        const confidencePercent = Math.round(similarity * 100);
        
        if (similarity >= minSimilarity) {
          console.log(`  ✓ Match found: "${stored.song_title}" by ${stored.artist} (${confidencePercent}% similarity)`);
          localMatches.push({
            title: stored.song_title,
            artist: stored.artist,
            album: stored.album,
            confidence: confidencePercent,
            source: 'Local Database (cached)',
            isrc: stored.isrc,
            spotify_id: stored.spotify_id,
            apple_music_id: stored.apple_music_id,
            youtube_id: stored.youtube_id,
            release_date: stored.release_date,
            segment: 'CACHED',
            match_quality: confidencePercent >= 85 ? 'high' : confidencePercent >= 60 ? 'medium' : 'low',
            cached: true,
            album_cover_url: stored.album_cover_url,
            preview_url: stored.preview_url,
            popularity: stored.popularity
          });
        }
      }
      
      if (localMatches.length > 0) {
        console.log(`\n⚡ INSTANT MATCH! Found ${localMatches.length} cached result(s) from local database`);
        console.log('✅ Skipping ACRCloud scan - returning cached matches\n');
        
        // Store the new fingerprint for this beat too
        const fingerprintHash = audioFeatures.hash;
        await supabaseClient
          .from('beat_fingerprints')
          .upsert({
            fingerprint_hash: fingerprintHash,
            song_title: localMatches[0].title,
            artist: localMatches[0].artist,
            album: localMatches[0].album,
            confidence_score: localMatches[0].confidence,
            source: 'local_cache',
            mfcc_features: audioFeatures.binaryFingerprint, // Store as hex string
            isrc: localMatches[0].isrc,
            spotify_id: localMatches[0].spotify_id,
            apple_music_id: localMatches[0].apple_music_id,
            release_date: localMatches[0].release_date,
            audio_duration_ms: audioFeatures.duration_ms
          }, { onConflict: 'fingerprint_hash' });
        
        return {
          results: localMatches,
          metrics: {
            segmentsScanned: 0,
            resultsBeforeFilter: localMatches.length,
            resultsAfterFilter: localMatches.length,
            confidenceScores: localMatches.map(m => m.confidence)
          },
          fromCache: true,
          platformStats: {
            acrcloud: {
              segmentsScanned: 0,
              segmentsSuccessful: 0,
              segmentsFailed: 0
            }
          }
        };
      }
      
      console.log('❌ No local matches found - proceeding to ACRCloud scan\n');
    }
  } catch (fingerprintError) {
    console.error('❌ Local fingerprint check failed:', fingerprintError);
    console.log('⚠️  Falling back to ACRCloud scan...\n');
  }
  
  // PHASE 2: ACRCloud external scan with dynamic segmentation (if no local matches found)
  console.log('🌐 PHASE 2: ACRCloud external scan with dynamic segmentation...');
  
  // Dynamic segment selection based on audio characteristics
  const targetSegmentCount = deepScan ? 8 : 4;
  let segments: AudioSegment[];
  
  try {
    segments = selectDynamicSegments(arrayBuffer, targetSegmentCount, deepScan);
    console.log(`✅ Selected ${segments.length} dynamic segments based on audio analysis`);
  } catch (error) {
    console.error('❌ Dynamic segmentation failed, using fixed positions:', error);
    // Fallback to fixed positions
    segments = deepScan ? [
      { offset: 0, name: 'FULL AUDIO (0%)', duration: fileSize, energy: 0.5, uniqueness: 1, priority: 'high' as const },
      { offset: Math.floor(fileSize * 0.1), name: '15s@10%', duration: 15 * 1024, energy: 0.4, uniqueness: 0.5, priority: 'medium' as const },
      { offset: Math.floor(fileSize * 0.2), name: '20s@20%', duration: 20 * 1024, energy: 0.5, uniqueness: 0.6, priority: 'medium' as const },
      { offset: Math.floor(fileSize * 0.35), name: '30s@35%', duration: 30 * 1024, energy: 0.7, uniqueness: 0.8, priority: 'high' as const },
      { offset: Math.floor(fileSize * 0.5), name: '30s@50%', duration: 30 * 1024, energy: 0.8, uniqueness: 0.9, priority: 'high' as const },
      { offset: Math.floor(fileSize * 0.65), name: '20s@65%', duration: 20 * 1024, energy: 0.6, uniqueness: 0.7, priority: 'medium' as const },
      { offset: Math.floor(fileSize * 0.8), name: '20s@80%', duration: 20 * 1024, energy: 0.5, uniqueness: 0.6, priority: 'low' as const },
      { offset: Math.floor(fileSize * 0.9), name: '15s@90%', duration: 15 * 1024, energy: 0.4, uniqueness: 0.5, priority: 'low' as const }
    ] : [
      { offset: 0, name: 'FULL AUDIO (0%)', duration: fileSize, energy: 0.5, uniqueness: 1, priority: 'high' as const },
      { offset: Math.floor(fileSize * 0.3), name: '30s@30%', duration: 30 * 1024, energy: 0.6, uniqueness: 0.7, priority: 'high' as const },
      { offset: Math.floor(fileSize * 0.6), name: '30s@60%', duration: 30 * 1024, energy: 0.7, uniqueness: 0.8, priority: 'medium' as const },
      { offset: Math.floor(fileSize * 0.85), name: '15s@85%', duration: 15 * 1024, energy: 0.5, uniqueness: 0.6, priority: 'low' as const }
    ];
  }
  
  // Track ACRCloud segment success/failure
  const matchingStartTime = Date.now();
  let acrcloudSuccessCount = 0;
  let acrcloudFailureCount = 0;
  
  // Scan all segments in parallel (for maximum speed)
  const segmentResults = await Promise.all(
    segments.map(seg => 
      identifySegmentWithACRCloud(arrayBuffer, fileName, seg.offset, seg.name)
        .then(results => {
          if (results.length > 0) {
            acrcloudSuccessCount++;
          }
          return { name: seg.name, results, energy: seg.energy, priority: seg.priority };
        })
        .catch(err => {
          console.error(`❌ ACRCloud segment ${seg.name} failed:`, err.message);
          acrcloudFailureCount++;
          return { name: seg.name, results: [], energy: seg.energy, priority: seg.priority };
        })
    )
  );
  
  const matchingEndTime = Date.now();
  const matchingMs = matchingEndTime - matchingStartTime;
  
  const allTracks = segmentResults.flatMap(sr => sr.results);
  console.log(`\n📊 ACRCLOUD SEGMENT RESULTS:`);
  console.log(`  Total segments scanned: ${segments.length}`);
  console.log(`  Successful: ${acrcloudSuccessCount} (returned results)`);
  console.log(`  No results: ${segments.length - acrcloudSuccessCount - acrcloudFailureCount}`);
  console.log(`  Failed: ${acrcloudFailureCount}`);
  console.log(`  Raw tracks found: ${allTracks.length}\n`);
  
  // Log which segments returned results
  segmentResults.forEach(sr => {
    const count = sr.results.length;
    if (count > 0) {
      console.log(`  ✓ ${sr.name}: ${count} results`);
    } else {
      console.log(`  ✗ ${sr.name}: no results`);
    }
  });
  
  // Deduplicate by ISRC first, then by title+artist
  const deduplicatedTracks: any[] = [];
  const seenISRCs = new Set<string>();
  const seenTitleArtist = new Set<string>();
  
  for (const track of allTracks) {
    // Group by ISRC if available
    if (track.isrc) {
      if (seenISRCs.has(track.isrc)) {
        continue; // Skip duplicate ISRC
      }
      seenISRCs.add(track.isrc);
    }
    
    // Group by title + artist combination
    const key = `${track.title.toLowerCase()}|||${track.artist.toLowerCase()}`;
    if (seenTitleArtist.has(key)) {
      continue; // Skip duplicate song
    }
    seenTitleArtist.add(key);
    
    deduplicatedTracks.push(track);
  }
  
  console.log(`\n📊 After deduplication: ${deduplicatedTracks.length} unique tracks`);
  
  // Apply adaptive confidence filter based on beat characteristics
  const MIN_CONFIDENCE = matchingMode === 'strict' ? adaptiveThresholds.strict : adaptiveThresholds.loose;
  const filtered = deduplicatedTracks.filter(track => track.confidence >= MIN_CONFIDENCE);
  
  console.log(`📊 After adaptive confidence filter (>=${MIN_CONFIDENCE}%): ${filtered.length} tracks\n`);
  
  // Log confidence distribution
  const confidenceScores = filtered.map(t => t.confidence);
  if (confidenceScores.length > 0) {
    const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    const maxConfidence = Math.max(...confidenceScores);
    const minConfidence = Math.min(...confidenceScores);
    
    console.log('📈 Confidence Score Distribution:');
    console.log(`  Average: ${avgConfidence.toFixed(1)}%`);
    console.log(`  Range: ${minConfidence}% - ${maxConfidence}%`);
    console.log(`  High (≥85%): ${confidenceScores.filter(s => s >= 85).length}`);
    console.log(`  Medium (60-84%): ${confidenceScores.filter(s => s >= 60 && s < 85).length}`);
    console.log(`  Low (50-59%): ${confidenceScores.filter(s => s >= 50 && s < 60).length}\n`);
  }
  
  console.log('=== SCAN COMPLETE ===\n');
  
  // Cache results to beat_fingerprints table with binary fingerprints for future instant matching
  if (filtered.length > 0 && supabaseClient) {
    console.log('💾 Caching results with binary fingerprints to database...');
    
    try {
      // Generate fingerprint for this beat
      const audioFeatures = await generateAudioFingerprint(arrayBuffer);
      console.log(`✅ Generated binary fingerprint (${audioFeatures.binaryFingerprint.length} chars)`);
      
      for (const track of filtered) {
        try {
          const fingerprintHash = track.isrc || audioFeatures.hash || `${track.title}|||${track.artist}`;
          await supabaseClient
            .from('beat_fingerprints')
            .upsert({
              fingerprint_hash: fingerprintHash,
              song_title: track.title,
              artist: track.artist,
              album: track.album,
              confidence_score: track.confidence,
              source: 'acrcloud',
              mfcc_features: audioFeatures.binaryFingerprint, // Store as hex string for Hamming distance
              isrc: track.isrc,
              spotify_id: track.spotify_id,
              apple_music_id: track.apple_music_id,
              youtube_id: track.youtube_id,
              release_date: track.release_date,
              audio_duration_ms: audioFeatures.duration_ms
            }, { onConflict: 'fingerprint_hash' });
        } catch (err) {
          console.error('Failed to cache track:', err);
        }
      }
      console.log(`✅ Cached ${filtered.length} tracks with fingerprints for instant future matching\n`);
    } catch (fingerprintError) {
      console.error('❌ Failed to generate fingerprint for caching:', fingerprintError);
      console.log('⚠️  Results cached without fingerprints\n');
    }
  }
  
  const metrics: ScanMetrics = {
    segmentsScanned: segments.length,
    resultsBeforeFilter: deduplicatedTracks.length,
    resultsAfterFilter: filtered.length,
    confidenceScores
  };
  
  return { 
    results: filtered, 
    metrics, 
    fromCache: false,
    platformStats: {
      acrcloud: {
        segmentsScanned: segments.length,
        segmentsSuccessful: acrcloudSuccessCount,
        segmentsFailed: acrcloudFailureCount
      }
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('\n🎵 === NEW BEAT IDENTIFICATION REQUEST ===\n');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Check if user is authenticated (optional for anonymous scans)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isAnonymous = true;
    
    if (authHeader) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (user && !authError) {
        userId = user.id;
        isAnonymous = false;
      }
    }
    
    // For anonymous users, check scan limit by IP
    if (isAnonymous) {
      const clientIp = req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       'unknown';
      
      console.log(`🕵️ Anonymous scan request from IP: ${clientIp}`);
      
      // Check if IP has already scanned
      const { data: existingScan, error: scanError } = await supabaseClient
        .from('anonymous_scans')
        .select('scan_count')
        .eq('ip_address', clientIp)
        .single();
      
      if (scanError && scanError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error checking anonymous scan:', scanError);
      }
      
      if (existingScan && existingScan.scan_count >= 1) {
        console.log(`❌ Anonymous user has exceeded free scan limit`);
        return new Response(
          JSON.stringify({ 
            error: 'Free scan limit reached',
            message: 'You have used your free scan. Sign up to access unlimited scans!',
            requiresAuth: true
          }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Update or create scan record
      if (existingScan) {
        await supabaseClient
          .from('anonymous_scans')
          .update({ 
            scan_count: existingScan.scan_count + 1,
            last_scan_at: new Date().toISOString()
          })
          .eq('ip_address', clientIp);
      } else {
        await supabaseClient
          .from('anonymous_scans')
          .insert({ 
            ip_address: clientIp,
            scan_count: 1
          });
      }
    }
    
    // Rate limiting
    const identifier = getClientIdentifier(req);
    const rateLimitResult = await checkRateLimit(identifier, 'identify-beat', { maxRequests: 10, windowMinutes: 1 });
    
    if (!rateLimitResult.allowed) {
      const resetIn = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetIn} seconds.`
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const deepScan = formData.get('deepScan') === 'true';
    const matchingMode = ((formData.get('matchingMode') as string) || 'loose') as 'loose' | 'strict';

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📁 Processing file: ${audioFile.name} (${audioFile.size} bytes)\n`);

    const arrayBuffer = await audioFile.arrayBuffer();
    
    // Step 1: Generate local binary fingerprint for fast exact matching
    let localMatches: any[] = [];
    try {
      console.log("🔍 Generating binary fingerprint for local database matching...");
      const fingerprint = await generateAudioFingerprint(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 1024 * 1024))); // Use first 1MB
      
      // Search local database for matches using Hamming distance
      const { data: storedFingerprints, error: fpError } = await supabaseClient
        .from('beat_fingerprints')
        .select('*')
        .not('fingerprint_hash', 'is', null);
      
      if (!fpError && storedFingerprints && storedFingerprints.length > 0) {
        console.log(`  Comparing against ${storedFingerprints.length} stored fingerprints...`);
        
        for (const stored of storedFingerprints) {
          if (!stored.fingerprint_hash || stored.fingerprint_hash.length < 100) continue;
          
          // Calculate Hamming distance similarity
          const similarity = calculateHammingDistance(
            fingerprint.binaryFingerprint,
            stored.fingerprint_hash
          );
          
          // Strict mode: ≥85% similarity = exact match
          // Loose mode: ≥70% similarity = close match
          const threshold = matchingMode === 'strict' ? 0.85 : 0.70;
          
          if (similarity >= threshold) {
            console.log(`  ✅ Local match: "${stored.song_title}" by ${stored.artist} (${(similarity * 100).toFixed(1)}% similarity)`);
            
            localMatches.push({
              title: stored.song_title,
              artist: stored.artist,
              album: stored.album || '',
              confidence: Math.floor(similarity * 100),
              source: 'Local Database',
              isrc: stored.isrc,
              spotify_id: stored.spotify_id,
              apple_music_id: stored.apple_music_id,
              youtube_id: stored.youtube_id,
              release_date: stored.release_date,
              segment: 'binary_fingerprint',
              match_quality: similarity >= 0.85 ? 'high' : 'medium',
            });
          }
        }
        
        if (localMatches.length > 0) {
          console.log(`✅ Found ${localMatches.length} local fingerprint matches\n`);
        } else {
          console.log(`  No local matches found\n`);
        }
      }
    } catch (fpError) {
      console.error("⚠️ Local fingerprint matching error:", fpError);
      // Continue with ACRCloud even if local matching fails
    }
    
    // Step 2: Run simplified ACRCloud scanning
    const { results: acrcloudMatches, metrics, fromCache, platformStats } = await identifyWithSimplifiedACRCloud(
      arrayBuffer, 
      audioFile.name,
      deepScan,
      matchingMode,
      supabaseClient
    );

    console.log(`\n🌐 === MULTI-SOURCE SEARCH ===`);
    console.log(`ACRCloud found ${acrcloudMatches.length} matches`);
    
    // Extract unique songs from ACRCloud to search other platforms
    const songsToSearch = Array.from(new Set(
      acrcloudMatches.slice(0, 5).map(m => JSON.stringify({ title: m.title, artist: m.artist }))
    )).map(s => JSON.parse(s));
    
    console.log(`\nSearching ${songsToSearch.length} songs across additional platforms:\n`);
    
    // Track platform search results
    let youtubeSuccess = 0;
    let youtubeFailed = 0;
    let spotifySuccess = 0;
    let spotifyFailed = 0;
    
    // Import multi-platform search
    const { searchAllPlatforms } = await import('../_shared/multiPlatformSearch.ts');
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') || '';
    
    // Run enhanced multi-platform search (YouTube Music, TikTok, SoundCloud) + existing Spotify
    const platformSearchPromises = songsToSearch.flatMap(song => [
      searchAllPlatforms(song.title, song.artist, youtubeApiKey).catch(err => {
        console.error(`❌ Multi-platform search failed for "${song.title}":`, err.message);
        return { youtube: [], tiktok: [], soundcloud: [], totalFound: 0 };
      }),
      searchSpotify(song.title, song.artist).catch(err => {
        console.error(`❌ Spotify search failed for "${song.title}":`, err.message);
        spotifyFailed++;
        return [];
      })
    ]);
    
    const platformResults = await Promise.all(platformSearchPromises);
    
    // Separate multi-platform results and Spotify results
    const multiPlatformResults = platformResults.filter((_, i) => i % 2 === 0);
    const spotifyMatches = platformResults.filter((_, i) => i % 2 === 1).flat();
    
    // Aggregate all YouTube Music results from multi-platform search
    const youtubeMatches = multiPlatformResults.flatMap((r: any) => r.youtube || []);
    const tiktokMatches = multiPlatformResults.flatMap((r: any) => r.tiktok || []);
    const soundcloudMatches = multiPlatformResults.flatMap((r: any) => r.soundcloud || []);
    
    // Count successes
    youtubeSuccess = multiPlatformResults.filter((r: any) => r.youtube?.length > 0).length;
    const tiktokSuccess = multiPlatformResults.filter((r: any) => r.tiktok?.length > 0).length;
    const soundcloudSuccess = multiPlatformResults.filter((r: any) => r.soundcloud?.length > 0).length;
    spotifySuccess = songsToSearch.length - spotifyFailed;
    
    console.log(`\n📊 PLATFORM SEARCH RESULTS:`);
    console.log(`  ACRCloud: ${acrcloudMatches.length} fingerprint matches`);
    console.log(`  YouTube Music: ${youtubeSuccess}/${songsToSearch.length} successful (${youtubeMatches.length} matches)`);
    console.log(`  TikTok: ${tiktokSuccess}/${songsToSearch.length} successful (${tiktokMatches.length} matches)`);
    console.log(`  SoundCloud: ${soundcloudSuccess}/${songsToSearch.length} successful (${soundcloudMatches.length} matches)`);
    console.log(`  Spotify: ${spotifySuccess}/${songsToSearch.length} successful (${spotifyMatches.length} matches)`);
    
    // Merge all results from all sources (local + ACRCloud + multi-platform)
    let allMatches: any[] = [...localMatches, ...acrcloudMatches];
    
    // Helper function to merge platform data into existing match
    const mergePlatformData = (existing: any, platformMatch: any, platformName: string, platformIdField: string, platformUrlField: string) => {
      if (!existing[platformIdField] && platformMatch[platformIdField]) {
        existing[platformIdField] = platformMatch[platformIdField];
        existing[platformUrlField] = platformMatch[platformUrlField];
      }
      existing.sources = existing.sources || ['ACRCloud'];
      if (!existing.sources.includes(platformName)) {
        existing.sources.push(platformName);
      }
    };
    
    // Merge YouTube Music matches
    for (const ytMatch of youtubeMatches) {
      const ytMatchAny = ytMatch as any;
      const existing: any = allMatches.find((m: any) => 
        m.youtube_id === ytMatchAny.youtube_id ||
        (m.title.toLowerCase() === ytMatchAny.title.toLowerCase() && 
         m.artist.toLowerCase() === ytMatchAny.artist.toLowerCase())
      );
      
      if (existing) {
        mergePlatformData(existing, ytMatchAny, 'YouTube', 'youtube_id', 'youtube_url');
      } else {
        // Add as new match with YouTube as source
        allMatches.push({ ...ytMatchAny, sources: ['YouTube'] });
      }
    }
    
    // Merge TikTok matches
    for (const ttMatch of tiktokMatches) {
      const ttMatchAny = ttMatch as any;
      const existing: any = allMatches.find((m: any) => 
        (m.title.toLowerCase() === ttMatchAny.title.toLowerCase() && 
         m.artist.toLowerCase() === ttMatchAny.artist.toLowerCase())
      );
      
      if (existing) {
        existing.sources = existing.sources || ['ACRCloud'];
        if (!existing.sources.includes('TikTok')) {
          existing.sources.push('TikTok');
        }
      } else {
        allMatches.push({ ...ttMatchAny, sources: ['TikTok'] });
      }
    }
    
    // Merge SoundCloud matches
    for (const scMatch of soundcloudMatches) {
      const scMatchAny = scMatch as any;
      const existing: any = allMatches.find((m: any) => 
        (m.title.toLowerCase() === scMatchAny.title.toLowerCase() && 
         m.artist.toLowerCase() === scMatchAny.artist.toLowerCase())
      );
      
      if (existing) {
        existing.sources = existing.sources || ['ACRCloud'];
        if (!existing.sources.includes('SoundCloud')) {
          existing.sources.push('SoundCloud');
        }
      } else {
        allMatches.push({ ...scMatchAny, sources: ['SoundCloud'] });
      }
    }
    
    // Add Spotify matches that aren't already in results
    for (const spMatch of spotifyMatches) {
      const spMatchAny = spMatch as any;
      const existing: any = allMatches.find((m: any) => 
        m.spotify_id === spMatchAny.spotify_id ||
        m.isrc === spMatchAny.isrc ||
        (m.title.toLowerCase() === spMatchAny.title.toLowerCase() && 
         m.artist.toLowerCase() === spMatchAny.artist.toLowerCase())
      );
      
      if (existing) {
        // Merge Spotify data into existing match
        if (!existing.spotify_id && spMatchAny.spotify_id) {
          existing.spotify_id = spMatchAny.spotify_id;
          existing.spotify_url = spMatchAny.spotify_url;
        }
        if (!existing.album_cover_url && spMatchAny.album_cover_url) {
          existing.album_cover_url = spMatchAny.album_cover_url;
        }
        if (!existing.preview_url && spMatchAny.preview_url) {
          existing.preview_url = spMatchAny.preview_url;
        }
        if (!existing.popularity && spMatchAny.popularity) {
          existing.popularity = spMatchAny.popularity;
        }
        existing.sources = existing.sources || ['ACRCloud'];
        if (!existing.sources.includes('Spotify')) {
          existing.sources.push('Spotify');
        }
      } else {
        // Add as new match with Spotify as source
        allMatches.push({ ...spMatchAny, sources: ['Spotify'] });
      }
    }
    
    // Mark ACRCloud-only matches
    allMatches.forEach((m: any) => {
      if (!m.sources) {
        m.sources = ['ACRCloud'];
      }
    });
    
    console.log(`\n📊 MERGED RESULTS: ${allMatches.length} total matches from all sources`);
    console.log(`  ACRCloud-only: ${allMatches.filter(m => m.sources?.length === 1 && m.sources[0] === 'ACRCloud').length}`);
    console.log(`  Multi-source: ${allMatches.filter(m => m.sources && m.sources.length > 1).length}`);
    
    // Platform health summary
    console.log(`\n🏥 PLATFORM HEALTH SUMMARY:`);
    console.log(`  ACRCloud: ${platformStats.acrcloud.segmentsSuccessful}/${platformStats.acrcloud.segmentsScanned} segments successful`);
    console.log(`  YouTube: ${youtubeSuccess}/${songsToSearch.length} searches successful`);
    console.log(`  Spotify: ${spotifySuccess}/${songsToSearch.length} searches successful\n`);

    const matches = allMatches;

    if (matches.length === 0) {
      console.log('❌ No matches found\n');
      return new Response(
        JSON.stringify({ 
          matches: [],
          message: "No confirmed matches found. Try uploading a longer or clearer version of the beat.",
          metrics,
          isAnonymous
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Returning ${matches.length} matches to client\n`);

    // Enrich with Spotify data
    const spotifyToken = await getSpotifyToken();
    
    if (spotifyToken) {
      console.log('🎧 Fetching Spotify track details...\n');
      
      for (const match of matches) {
        if (match.spotify_id) {
          const spotifyDetails = await getSpotifyTrackDetails(match.spotify_id, spotifyToken);
          match.album_cover_url = spotifyDetails.artworkUrl;
          match.preview_url = spotifyDetails.previewUrl;
          match.popularity = spotifyDetails.popularity;
          match.spotify_url = spotifyDetails.isAvailable 
            ? `https://open.spotify.com/track/${match.spotify_id}`
            : null;
        }
        
        // Try iTunes Search for Apple Music ID if not found
        if (!match.apple_music_id && match.title && match.artist) {
          const appleMusicId = await searchAppleMusic(match.title, match.artist);
          match.apple_music_id = appleMusicId;
        }
        
        // Construct platform URLs
        if (match.apple_music_id) {
          match.apple_music_url = `https://music.apple.com/song/${match.apple_music_id}`;
        }
        
        if (match.youtube_id) {
          match.youtube_url = `https://music.youtube.com/watch?v=${match.youtube_id}`;
        }
      }
    }
    
    // Intelligent ranking: prioritize cross-platform validation
    // Formula: (source_count * 1000) + (confidence * 10) + (popularity_normalized)
    // Multi-source matches will ALWAYS rank higher than single-source due to 1000x weight
    matches.sort((a, b) => {
      const sourceCountA = a.sources?.length || 1;
      const sourceCountB = b.sources?.length || 1;
      const confidenceA = a.confidence || 0;
      const confidenceB = b.confidence || 0;
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      
      // Calculate ranking score for each match
      const scoreA = (sourceCountA * 1000) + (confidenceA * 10) + (popA / 100);
      const scoreB = (sourceCountB * 1000) + (confidenceB * 10) + (popB / 100);
      
      return scoreB - scoreA; // Higher score = better rank
    });
    
    console.log('🏆 RANKING APPLIED:');
    const multiSource = matches.filter(m => m.sources && m.sources.length > 1).length;
    const singleSource = matches.filter(m => !m.sources || m.sources.length === 1).length;
    console.log(`  Multi-source matches (higher priority): ${multiSource}`);
    console.log(`  Single-source matches: ${singleSource}\n`);
    
    // Store binary fingerprints in database for future local matching
    if (matches.length > 0 && arrayBuffer) {
      try {
        console.log('💾 Storing binary fingerprints for future local matching...');
        const fingerprint = await generateAudioFingerprint(
          arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 1024 * 1024))
        );
        
        // Store top 3 matches as fingerprints
        for (const match of matches.slice(0, 3)) {
          await supabaseClient
            .from('beat_fingerprints')
            .upsert({
              fingerprint_hash: fingerprint.binaryFingerprint,
              song_title: match.title,
              artist: match.artist,
              album: match.album,
              audio_duration_ms: fingerprint.duration_ms,
              confidence_score: match.confidence,
              spotify_url: match.spotify_url,
              spotify_id: match.spotify_id,
              youtube_url: match.youtube_url,
              youtube_id: match.youtube_id,
              apple_music_url: match.apple_music_url,
              apple_music_id: match.apple_music_id,
              preview_url: match.preview_url,
              release_date: match.release_date,
              popularity: match.popularity,
              source: match.source || 'multi_source',
              mfcc_features: fingerprint.mfcc,
              isrc: match.isrc,
            }, {
              onConflict: 'fingerprint_hash',
              ignoreDuplicates: false,
            });
        }
        
        console.log(`✅ Stored ${Math.min(matches.length, 3)} binary fingerprints\n`);
      } catch (storeError) {
        console.error("⚠️ Error storing fingerprints:", storeError);
        // Don't fail the request if storage fails
      }
    }

    return new Response(
      JSON.stringify({ 
        matches,
        total: matches.length,
        metrics: {
          ...metrics,
          localMatches: localMatches.length,
        },
        fromCache,
        isAnonymous
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
