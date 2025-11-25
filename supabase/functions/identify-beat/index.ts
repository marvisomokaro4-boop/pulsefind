import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get Spotify access token
async function getSpotifyToken(): Promise<string | null> {
  try {
    const clientId = '6c22aaa3cdda4d9aa4fa9f8db7e219e2'; // Public Spotify client ID
    const clientSecret = 'your_client_secret_here'; // Would need to be stored as secret
    
    // For now, we'll skip Spotify API calls and construct URLs directly
    return null;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

// Helper function to get album artwork from Spotify
async function getSpotifyAlbumArt(trackId: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const images = data.album?.images;
    
    // Return the medium-sized image (typically 300x300)
    if (images && images.length > 0) {
      return images[1]?.url || images[0]?.url;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Spotify album art:', error);
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
      external_metadata?: {
        spotify?: { 
          track: { id: string };
          album?: { id: string };
        };
        apple_music?: { track: { id: string } };
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
          apple_music_id: track.external_metadata?.apple_music?.track?.id,
          release_date: track.release_date,
          album_cover_url: albumCoverUrl,
          segment: segmentName,
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
    // Extract segments from beginning, middle, and end of the beat
    const fileSize = arrayBuffer.byteLength;
    const segments = [];
    
    // Beginning (0-500KB)
    segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, 0, 'beginning'));
    
    // Middle (if file is large enough)
    if (fileSize > 1000 * 1024) {
      const middleStart = Math.floor(fileSize / 2) - 250 * 1024;
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, middleStart, 'middle'));
    }
    
    // End (if file is large enough)
    if (fileSize > 500 * 1024) {
      const endStart = Math.max(0, fileSize - 500 * 1024);
      segments.push(identifySegmentWithACRCloud(arrayBuffer, fileName, endStart, 'end'));
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
