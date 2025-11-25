import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get Spotify access token
async function getSpotifyToken(): Promise<string | null> {
  try {
    // Using Spotify's Client Credentials flow
    const clientId = 'ea3bdfe7f2d24660b598b8a5c3d64470';
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
async function getSpotifyTrackDetails(trackId: string, token: string): Promise<{ artworkUrl: string | null, previewUrl: string | null, isAvailable: boolean }> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Spotify API error for track ${trackId}: ${response.status}`);
      return { artworkUrl: null, previewUrl: null, isAvailable: false };
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
    
    return { artworkUrl, previewUrl, isAvailable };
  } catch (error) {
    console.error('Error fetching Spotify track details:', error);
    return { artworkUrl: null, previewUrl: null, isAvailable: false };
  }
}

// Helper function to search Apple Music using iTunes Search API
async function searchAppleMusic(title: string, artist: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${searchQuery}&media=music&entity=song&limit=5`
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
      
      // Find the best match
      for (const result of data.results) {
        const resultTitle = normalizeString(result.trackName || '');
        const resultArtist = normalizeString(result.artistName || '');
        
        // Check if title and artist match closely
        if (resultTitle.includes(normalizedTitle) || normalizedTitle.includes(resultTitle)) {
          if (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist)) {
            console.log(`Found Apple Music match via iTunes Search: ${result.trackId} - "${result.trackName}" by ${result.artistName}`);
            return result.trackId?.toString() || null;
          }
        }
      }
      
      // If no exact match found, log the first result for debugging
      console.log(`No exact match found. First result was: "${data.results[0].trackName}" by ${data.results[0].artistName} (ID: ${data.results[0].trackId})`);
      console.log(`Searched for: "${title}" by ${artist}`);
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
    
    console.log(`Processing ${segmentName} segment: ${sampleSize} bytes from offset ${segmentStart}`);
    
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

    const response = await fetch(`https://${acrcloudHost}/v1/identify`, {
      method: 'POST',
      body: formData,
    });

    const data: ACRCloudResponse = await response.json();
    console.log(`ACRCloud response for ${segmentName}:`, JSON.stringify(data));

    if (data.status.code === 0 && data.metadata?.music) {
      return data.metadata.music.map(track => {
        // Construct Spotify album artwork URL if we have spotify album ID
        let albumCoverUrl = null;
        if (track.external_metadata?.spotify?.album?.id) {
          // We'll fetch this from Spotify API in a moment
          albumCoverUrl = `https://i.scdn.co/image/${track.external_metadata.spotify.album.id}`;
        } else if (track.external_metadata?.spotify?.track?.id) {
          // Fallback: use track ID to construct cover URL (will need Spotify API)
          albumCoverUrl = null; // Will be populated via Spotify API
        }

        return {
          title: track.title,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          confidence: track.score,
          source: 'ACRCloud',
          spotify_id: track.external_metadata?.spotify?.track?.id,
          spotify_album_id: track.external_metadata?.spotify?.album?.id,
          apple_music_id: track.external_metadata?.applemusic?.track?.id || 
                          track.external_metadata?.apple_music?.track?.id,
          youtube_id: track.external_metadata?.youtube?.vid,
          release_date: track.release_date,
          album_cover_url: albumCoverUrl,
          segment: segmentName,
          acrid: track.acrid, // Store ACRCloud ID for metadata lookup
        };
      });
    }

    return [];
  } catch (error) {
    console.error(`ACRCloud error for ${segmentName}:`, error);
    return [];
  }
}

async function identifyWithACRCloud(arrayBuffer: ArrayBuffer, fileName: string): Promise<any[]> {
  const acrcloudAccessKey = Deno.env.get('ACRCLOUD_ACCESS_KEY');
  const acrcloudAccessSecret = Deno.env.get('ACRCLOUD_ACCESS_SECRET');

  if (!acrcloudAccessKey || !acrcloudAccessSecret) {
    console.log('ACRCloud credentials not configured');
    return [];
  }

  try {
    // Extract 7 segments across the beat for comprehensive analysis
    const fileSize = arrayBuffer.byteLength;
    const segments = [];
    
    // Always analyze beginning
    segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, 0, 'beginning (0%)'));
    
    // Additional segments based on file size
    if (fileSize > 500 * 1024) {
      // 12.5% mark
      const segment12 = Math.floor(fileSize * 0.125);
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, segment12, '12.5% mark'));
    }
    
    if (fileSize > 1000 * 1024) {
      // 25% mark
      const segment25 = Math.floor(fileSize * 0.25);
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, segment25, '25% mark'));
    }
    
    if (fileSize > 1500 * 1024) {
      // Middle (50%)
      const middleStart = Math.floor(fileSize / 2) - 250 * 1024;
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, middleStart, 'middle (50%)'));
    }
    
    if (fileSize > 2000 * 1024) {
      // 75% mark
      const segment75 = Math.floor(fileSize * 0.75) - 250 * 1024;
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, segment75, '75% mark'));
    }
    
    if (fileSize > 2500 * 1024) {
      // 87.5% mark
      const segment87 = Math.floor(fileSize * 0.875) - 250 * 1024;
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, segment87, '87.5% mark'));
    }
    
    // Always analyze end if file is large enough
    if (fileSize > 500 * 1024) {
      const endStart = Math.max(0, fileSize - 500 * 1024);
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, endStart, 'end (100%)'));
    }

    // Process all segments in parallel
    const allSegmentResults = await Promise.all(segments);
    const allTracks = allSegmentResults.flat();

    console.log(`Total tracks found across all segments: ${allTracks.length}`);

    // Aggregate results: group by title+artist and pick highest confidence
    const trackMap = new Map<string, any>();
    
    for (const track of allTracks) {
      const key = `${track.title}-${track.artist}`;
      const existing = trackMap.get(key);
      
      if (!existing || track.confidence > existing.confidence) {
        trackMap.set(key, track);
      }
    }

    // Convert to array and sort by confidence
    let results = Array.from(trackMap.values());
    
    // Filter out very low-confidence matches (below 40)
    results = results.filter(track => track.confidence >= 40);
    
    // Sort by confidence (descending)
    results.sort((a, b) => b.confidence - a.confidence);
    
    // Return top 5 matches (increased from 3 to show more options)
    const topMatches = results.slice(0, 5);
    
    console.log(`Returning ${topMatches.length} matches (filtered below 40% confidence)`);
    
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

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const beatYear = formData.get('beatYear') as string | null;

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

    // Run both APIs in parallel
    const [acrcloudResults, shazamResults] = await Promise.all([
      identifyWithACRCloud(arrayBuffer, audioFile.name),
      identifyWithShazam(arrayBuffer),
    ]);

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
            const { artworkUrl, previewUrl, isAvailable } = await getSpotifyTrackDetails(track.spotify_id, spotifyToken);
            
            const spotify_url = `https://open.spotify.com/track/${track.spotify_id}`;
            const apple_music_url = apple_music_id ? `https://music.apple.com/us/song/${apple_music_id}` : null;
            const youtube_url = track.youtube_id ? `https://www.youtube.com/watch?v=${track.youtube_id}` : null;
            
            return { 
              ...track,
              apple_music_id,
              album_cover_url: artworkUrl || track.album_cover_url,
              preview_url: previewUrl,
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

    return new Response(
      JSON.stringify({ 
        success: true,
        matches,
        sources_used: {
          acrcloud: acrcloudResults.length > 0,
          shazam: shazamResults.length > 0,
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
