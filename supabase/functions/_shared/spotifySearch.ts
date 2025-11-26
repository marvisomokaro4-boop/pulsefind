/**
 * Spotify Web API integration for searching tracks by song/beat metadata
 */

interface SpotifySearchResult {
  title: string;
  artist: string;
  album?: string;
  spotify_id: string;
  spotify_url: string;
  isrc?: string;
  popularity: number;
  preview_url?: string;
  album_cover_url?: string;
  source: string;
  confidence: number;
}

let spotifyAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get or refresh Spotify access token
 */
async function getSpotifyAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (spotifyAccessToken && Date.now() < tokenExpiresAt) {
    return spotifyAccessToken;
  }

  const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
  const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured');
  }

  const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.statusText}`);
  }

  const data = await response.json();
  spotifyAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

  if (!spotifyAccessToken) {
    throw new Error('Failed to obtain Spotify access token');
  }

  return spotifyAccessToken;
}

/**
 * Search Spotify for tracks matching the song/beat metadata
 */
export async function searchSpotify(
  songTitle: string,
  artist?: string
): Promise<SpotifySearchResult[]> {
  try {
    const token = await getSpotifyAccessToken();

    // Construct search query
    const query = artist 
      ? `track:${songTitle} artist:${artist}` 
      : `track:${songTitle}`;
    
    const searchQuery = encodeURIComponent(query);

    console.log(`🔍 Spotify search: "${query}"`);

    // Search Spotify tracks
    const searchUrl = `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=10`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️  Spotify search failed: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.tracks?.items?.length) {
      console.log('ℹ️  Spotify found no matches');
      return [];
    }

    // Map Spotify results to our format
    const results: SpotifySearchResult[] = data.tracks.items.map((track: any) => {
      const artists = track.artists.map((a: any) => a.name).join(', ');
      
      // Calculate confidence based on search ranking and popularity
      const positionScore = 100 - (data.tracks.items.indexOf(track) * 5); // Higher for top results
      const popularityScore = track.popularity; // 0-100
      const confidence = Math.round((positionScore + popularityScore) / 2);

      return {
        title: track.name,
        artist: artists,
        album: track.album?.name,
        spotify_id: track.id,
        spotify_url: track.external_urls?.spotify,
        isrc: track.external_ids?.isrc,
        popularity: track.popularity,
        preview_url: track.preview_url,
        album_cover_url: track.album?.images?.[0]?.url,
        source: 'Spotify',
        confidence: Math.min(confidence, 100),
      };
    });

    // Filter results with minimum confidence (50%)
    const filtered = results.filter(r => r.confidence >= 50);
    console.log(`✅ Spotify found ${filtered.length}/${data.tracks.items.length} matches`);

    return filtered;

  } catch (error) {
    console.error('❌ Spotify search error:', error);
    return [];
  }
}
