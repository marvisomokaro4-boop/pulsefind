import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpotifyAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  popularity: number;
  name: string;
  id: string;
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.statusText}`);
  }

  const data: SpotifyAuthResponse = await response.json();
  return data.access_token;
}

async function fetchSpotifyTrackData(trackIds: string[], accessToken: string): Promise<Map<string, number>> {
  const popularityMap = new Map<string, number>();
  
  // Spotify API allows up to 50 tracks per request
  const chunkSize = 50;
  
  for (let i = 0; i < trackIds.length; i += chunkSize) {
    const chunk = trackIds.slice(i, i + chunkSize);
    const idsParam = chunk.join(',');
    
    const response = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${idsParam}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch tracks: ${response.statusText}`);
      continue;
    }

    const data = await response.json();
    
    if (data.tracks) {
      for (const track of data.tracks) {
        if (track && track.id && typeof track.popularity === 'number') {
          popularityMap.set(track.id, track.popularity);
        }
      }
    }
  }

  return popularityMap;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackIds } = await req.json();

    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'trackIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching popularity for ${trackIds.length} tracks`);

    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();

    // Fetch track data
    const popularityMap = await fetchSpotifyTrackData(trackIds, accessToken);

    console.log(`Successfully fetched popularity for ${popularityMap.size} tracks`);

    return new Response(
      JSON.stringify({ popularity: Object.fromEntries(popularityMap) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Spotify popularity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
