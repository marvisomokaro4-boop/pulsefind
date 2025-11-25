import { Card } from "@/components/ui/card";
import { Music, ExternalLink, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Match {
  title: string;
  artist: string;
  album?: string;
  confidence?: number;
  source: string;
  spotify_id?: string;
  spotify_url?: string;
  apple_music_id?: string;
  apple_music_url?: string;
  share_url?: string;
}

interface SongResultsProps {
  matches: Match[];
}

const SongResults = ({ matches }: SongResultsProps) => {
  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-xl text-muted-foreground">No matches found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Your beat might not be in any released tracks yet, or it may need better audio quality for identification.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Songs Using Your Beat</h2>
        <p className="text-muted-foreground">Found {matches.length} track{matches.length > 1 ? 's' : ''} containing your beat</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map((match, index) => (
          <Card
            key={`${match.title}-${match.artist}-${index}`}
            className="overflow-hidden bg-card border-primary/10 hover:border-primary/30 transition-all group"
          >
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/20 to-background">
              <div className="absolute inset-0 flex items-center justify-center">
                <Music className="w-24 h-24 text-primary/30" />
              </div>
              <div className="absolute top-4 right-4">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                  {match.source}
                </Badge>
              </div>
              {match.confidence && (
                <div className="absolute top-4 left-4">
                  <Badge variant="secondary" className="bg-primary/20 backdrop-blur">
                    <Shield className="w-3 h-3 mr-1" />
                    {Math.round(match.confidence)}%
                  </Badge>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-bold text-lg text-foreground line-clamp-2">{match.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {match.artist}
                </p>
                {match.album && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {match.album}
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-4 space-y-2">
              {match.spotify_url && (
                <a
                  href={match.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#1DB954] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Open in Spotify
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              
              {match.spotify_id && !match.spotify_url && (
                <a
                  href={`https://open.spotify.com/track/${match.spotify_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#1DB954] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Open in Spotify
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {match.apple_music_url && (
                <a
                  href={match.apple_music_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-gradient-to-r from-[#FA243C] to-[#FA5C7C] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Open in Apple Music
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {match.apple_music_id && !match.apple_music_url && (
                <a
                  href={`https://music.apple.com/song/${match.apple_music_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-gradient-to-r from-[#FA243C] to-[#FA5C7C] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Open in Apple Music
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {match.share_url && !match.spotify_url && !match.apple_music_url && (
                <a
                  href={match.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  View Details
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SongResults;
