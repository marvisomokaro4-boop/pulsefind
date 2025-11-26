import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";
import { searchYouTube } from "../_shared/youtubeSearch.ts";
import { searchSpotify } from "../_shared/spotifySearch.ts";

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
): Promise<{ results: any[], metrics: ScanMetrics, fromCache: boolean }> {
  const fileSize = arrayBuffer.byteLength;
  
  console.log('\n=== SIMPLIFIED ACRCLOUD SCANNING ===');
  console.log(`File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Deep Scan Mode: ${deepScan ? 'ENABLED (7 segments)' : 'DISABLED (3 segments)'}`);
  console.log(`Matching Mode: ${matchingMode.toUpperCase()} (${matchingMode === 'strict' ? '≥85%' : '≥40%'} confidence)`);
  // Define segments based on scan mode
  const segments = deepScan ? [
    { offset: 0, name: 'START (0%)' },
    { offset: Math.floor(fileSize * 0.2), name: 'EARLY (20%)' },
    { offset: Math.floor(fileSize * 0.35), name: 'MID-EARLY (35%)' },
    { offset: Math.floor(fileSize * 0.5), name: 'MIDDLE (50%)' },
    { offset: Math.floor(fileSize * 0.65), name: 'MID-LATE (65%)' },
    { offset: Math.floor(fileSize * 0.8), name: 'LATE (80%)' },
    { offset: Math.floor(fileSize * 0.9), name: 'END (90%)' }
  ] : [
    { offset: 0, name: 'START (0%)' },
    { offset: Math.floor(fileSize * 0.5), name: 'MIDDLE (50%)' },
    { offset: Math.floor(fileSize * 0.9), name: 'END (90%)' }
  ];
  
  console.log(`Scanning ${segments.length} segments: ${segments.map(s => s.name).join(', ')}\n`);
  
  // Scan all segments in parallel (for maximum speed)
  const segmentResults = await Promise.all(
    segments.map(seg => identifySegmentWithACRCloud(arrayBuffer, fileName, seg.offset, seg.name))
  );
  
  const allTracks = segmentResults.flat();
  console.log(`\n📊 Raw results from all segments: ${allTracks.length} tracks`);
  
  // Log which segments returned results
  segments.forEach((seg, i) => {
    const count = segmentResults[i].length;
    if (count > 0) {
      console.log(`  ✓ ${seg.name}: ${count} results`);
    } else {
      console.log(`  ✗ ${seg.name}: no results`);
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
  
  // Apply confidence filter based on matching mode
  const MIN_CONFIDENCE = matchingMode === 'strict' ? 85 : 40;
  const filtered = deduplicatedTracks.filter(track => track.confidence >= MIN_CONFIDENCE);
  
  console.log(`📊 After confidence filter (>=${MIN_CONFIDENCE}): ${filtered.length} tracks\n`);
  
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
  
  // Cache results to beat_fingerprints table for future lookups
  if (filtered.length > 0 && supabaseClient) {
    console.log('💾 Caching results to database...');
    for (const track of filtered) {
      try {
        await supabaseClient
          .from('beat_fingerprints')
          .upsert({
            fingerprint_hash: track.isrc || `${track.title}|||${track.artist}`,
            song_title: track.title,
            artist: track.artist,
            album: track.album,
            confidence_score: track.confidence,
            source: 'acrcloud',
            isrc: track.isrc,
            spotify_id: track.spotify_id,
            apple_music_id: track.apple_music_id,
            youtube_id: track.youtube_id,
            release_date: track.release_date,
          }, { onConflict: 'fingerprint_hash' });
      } catch (err) {
        console.error('Failed to cache track:', err);
      }
    }
    console.log(`✅ Cached ${filtered.length} tracks\n`);
  }
  
  const metrics: ScanMetrics = {
    segmentsScanned: segments.length,
    resultsBeforeFilter: deduplicatedTracks.length,
    resultsAfterFilter: filtered.length,
    confidenceScores
  };
  
  return { results: filtered, metrics, fromCache: false };
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
    
    // Run simplified ACRCloud scanning
    const { results: acrcloudMatches, metrics, fromCache } = await identifyWithSimplifiedACRCloud(
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
    
    // Run YouTube and Spotify searches in parallel for each ACRCloud result
    const multiSourcePromises = songsToSearch.flatMap(song => [
      searchYouTube(song.title, song.artist),
      searchSpotify(song.title, song.artist)
    ]);
    
    const multiSourceResults = await Promise.all(multiSourcePromises);
    const youtubeMatches = multiSourceResults.filter((_, i) => i % 2 === 0).flat();
    const spotifyMatches = multiSourceResults.filter((_, i) => i % 2 === 1).flat();
    
    console.log(`YouTube found ${youtubeMatches.length} additional matches`);
    console.log(`Spotify found ${spotifyMatches.length} additional matches`);
    
    // Merge all results from all sources
    let allMatches: any[] = [...acrcloudMatches];
    
    // Add YouTube matches that aren't already in ACRCloud results
    for (const ytMatch of youtubeMatches) {
      const ytMatchAny = ytMatch as any;
      const existing: any = allMatches.find((m: any) => 
        m.youtube_id === ytMatchAny.youtube_id ||
        (m.title.toLowerCase() === ytMatchAny.title.toLowerCase() && 
         m.artist.toLowerCase() === ytMatchAny.artist.toLowerCase())
      );
      
      if (existing) {
        // Merge YouTube data into existing match
        if (!existing.youtube_id && ytMatchAny.youtube_id) {
          existing.youtube_id = ytMatchAny.youtube_id;
          existing.youtube_url = ytMatchAny.youtube_url;
        }
        existing.sources = existing.sources || ['ACRCloud'];
        if (!existing.sources.includes('YouTube')) {
          existing.sources.push('YouTube');
        }
      } else {
        // Add as new match with YouTube as source
        allMatches.push({ ...ytMatchAny, sources: ['YouTube'] });
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
    console.log(`  Multi-source: ${allMatches.filter(m => m.sources && m.sources.length > 1).length}\n`);

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

    return new Response(
      JSON.stringify({ 
        matches,
        total: matches.length,
        metrics,
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
