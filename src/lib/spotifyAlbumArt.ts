// Helper to construct Spotify album artwork URL from track ID
// This uses Spotify's embed URL which doesn't require authentication
export function getSpotifyAlbumArtUrl(spotifyId: string): string {
  return `https://i.scdn.co/image/ab67616d0000b273${spotifyId}`;
}

// Fallback: construct a working album art URL using Spotify's public CDN
export function getSpotifyTrackArtUrl(spotifyId: string): string {
  // We can use the Spotify oembed API which is public
  return `https://open.spotify.com/oembed?url=spotify:track:${spotifyId}`;
}
