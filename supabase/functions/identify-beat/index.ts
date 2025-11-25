import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        spotify?: { track: { id: string } };
        apple_music?: { track: { id: string } };
      };
      score: number;
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

async function identifyWithACRCloud(arrayBuffer: ArrayBuffer, fileName: string): Promise<any[]> {
  const acrcloudHost = "identify-eu-west-1.acrcloud.com";
  const acrcloudAccessKey = Deno.env.get('ACRCLOUD_ACCESS_KEY');
  const acrcloudAccessSecret = Deno.env.get('ACRCLOUD_ACCESS_SECRET');

  if (!acrcloudAccessKey || !acrcloudAccessSecret) {
    console.log('ACRCloud credentials not configured');
    return [];
  }

  try {
    const audioData = new Uint8Array(arrayBuffer);
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
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
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
    console.log('ACRCloud response:', JSON.stringify(data));

    if (data.status.code === 0 && data.metadata?.music) {
      return data.metadata.music.map(track => ({
        title: track.title,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        confidence: track.score,
        source: 'ACRCloud',
        spotify_id: track.external_metadata?.spotify?.track?.id,
        apple_music_id: track.external_metadata?.apple_music?.track?.id,
      }));
    }

    return [];
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

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing audio file:', audioFile.name, 'size:', audioFile.size);

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

    const matches = Array.from(uniqueResults.values());

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
