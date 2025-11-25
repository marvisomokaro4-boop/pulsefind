import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface AudioFeatures {
  tempo: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bpm } = await req.json();
    console.log('Searching for songs with BPM:', bpm);

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    // Get Spotify access token
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      console.error('Spotify auth failed:', await authResponse.text());
      throw new Error('Failed to authenticate with Spotify');
    }

    const authData: SpotifyAuthResponse = await authResponse.json();
    const accessToken = authData.access_token;

    // Search for popular tracks
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=year:2020-2024&type=track&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      console.error('Spotify search failed:', await searchResponse.text());
      throw new Error('Failed to search Spotify');
    }

    const searchData = await searchResponse.json();
    const tracks: SpotifyTrack[] = searchData.tracks.items;

    // Get audio features for all tracks
    const trackIds = tracks.map((t: SpotifyTrack) => t.id).join(',');
    const featuresResponse = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${trackIds}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!featuresResponse.ok) {
      console.error('Audio features failed:', await featuresResponse.text());
      throw new Error('Failed to get audio features');
    }

    const featuresData = await featuresResponse.json();
    const audioFeatures: AudioFeatures[] = featuresData.audio_features;

    // Match tracks with similar BPM (within ±5 BPM)
    const matchedSongs = tracks
      .map((track: SpotifyTrack, index: number) => {
        const features = audioFeatures[index];
        if (!features) return null;

        const trackBpm = Math.round(features.tempo);
        const bpmDiff = Math.abs(trackBpm - bpm);

        if (bpmDiff <= 5) {
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((a) => a.name),
            album: track.album.name,
            image: track.album.images[0]?.url || '',
            previewUrl: track.preview_url,
            spotifyUrl: track.external_urls.spotify,
            bpm: trackBpm,
            bpmDiff,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.bpmDiff - b!.bpmDiff)
      .slice(0, 12);

    console.log(`Found ${matchedSongs.length} matching songs`);

    return new Response(
      JSON.stringify({ songs: matchedSongs }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in search-songs-by-bpm function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
