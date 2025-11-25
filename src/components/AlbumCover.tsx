import { Music } from "lucide-react";
import { useState } from "react";

interface AlbumCoverProps {
  albumCoverUrl?: string;
  spotifyId?: string;
  title: string;
  className?: string;
}

const AlbumCover = ({ albumCoverUrl, spotifyId, title, className = "" }: AlbumCoverProps) => {
  const [imageError, setImageError] = useState(false);
  const [spotifyImageLoaded, setSpotifyImageLoaded] = useState(false);

  // If we have a direct album cover URL, use it
  if (albumCoverUrl && !imageError) {
    return (
      <img
        src={albumCoverUrl}
        alt={`${title} album cover`}
        className={`w-full h-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Try to load from Spotify using track ID (this won't work directly, but we can try)
  // Spotify doesn't allow direct image embedding without API, so we'll show the fallback
  if (spotifyId && !imageError && !spotifyImageLoaded) {
    // We could potentially use Spotify's oEmbed endpoint, but it requires making a request
    // For now, we'll just show the fallback icon
  }

  // Fallback to icon
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background ${className}`}>
      <Music className="w-24 h-24 text-primary/30" />
    </div>
  );
};

export default AlbumCover;
