import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Music, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlbumCover from "./AlbumCover";

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
  youtube_id?: string;
  youtube_url?: string;
  share_url?: string;
  album_cover_url?: string;
  preview_url?: string;
}

interface BeatResult {
  fileName: string;
  matches: Match[];
  success: boolean;
}

interface BatchResultsProps {
  results: BeatResult[];
}

const BatchResults = ({ results }: BatchResultsProps) => {
  if (!results || results.length === 0) {
    return null;
  }

  const openSpotify = (spotifyId?: string, spotifyUrl?: string) => {
    if (spotifyUrl) {
      window.open(spotifyUrl, '_blank');
    } else if (spotifyId) {
      window.open(`https://open.spotify.com/track/${spotifyId}`, '_blank');
    }
  };

  const openAppleMusic = (appleMusicId?: string, appleMusicUrl?: string) => {
    if (appleMusicUrl) {
      window.open(appleMusicUrl, '_blank');
    } else if (appleMusicId) {
      window.open(`https://music.apple.com/us/album/${appleMusicId}`, '_blank');
    }
  };

  const openYouTubeMusic = (youtubeId?: string, youtubeUrl?: string) => {
    if (youtubeUrl) {
      window.open(youtubeUrl, '_blank');
    } else if (youtubeId) {
      window.open(`https://music.youtube.com/watch?v=${youtubeId}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Batch Analysis Results</h2>
        <p className="text-muted-foreground">
          Comparing {results.length} beat{results.length > 1 ? 's' : ''} side-by-side
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((result, index) => (
          <Card key={index} className="p-6 space-y-4 bg-card/50 backdrop-blur">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                <h3 className="font-semibold truncate" title={result.fileName}>
                  {result.fileName}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={result.success && result.matches.length > 0 ? "default" : "secondary"}>
                  {result.success && result.matches.length > 0 
                    ? `${result.matches.length} Match${result.matches.length > 1 ? 'es' : ''}`
                    : 'No Matches'
                  }
                </Badge>
              </div>
            </div>

            {result.success && result.matches.length > 0 ? (
              <div className="space-y-3">
                {result.matches.map((match, matchIndex) => (
                  <div
                    key={matchIndex}
                    className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-3"
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                        <AlbumCover
                          albumCoverUrl={match.album_cover_url}
                          spotifyId={match.spotify_id}
                          title={match.title}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-semibold line-clamp-1">{match.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {match.artist}
                        </p>
                        {match.album && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {match.album}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {match.source}
                        </Badge>
                        {match.confidence && (
                          <Badge 
                            variant={match.confidence >= 80 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {match.confidence}% match
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            match.preview_url 
                              ? 'border-primary/30 text-primary' 
                              : 'border-muted text-muted-foreground'
                          }`}
                        >
                          {match.preview_url ? (
                            <>
                              <Play className="w-2.5 h-2.5 mr-1 fill-current" />
                              Preview
                            </>
                          ) : (
                            <>
                              <X className="w-2.5 h-2.5 mr-1" />
                              No Preview
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(match.spotify_id || match.spotify_url) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openSpotify(match.spotify_id, match.spotify_url)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Spotify
                        </Button>
                      )}
                      {(match.apple_music_id || match.apple_music_url) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openAppleMusic(match.apple_music_id, match.apple_music_url)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Apple
                        </Button>
                      )}
                      {(match.youtube_id || match.youtube_url) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openYouTubeMusic(match.youtube_id, match.youtube_url)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          YouTube
                        </Button>
                      )}
                      {!match.spotify_id && !match.spotify_url && !match.apple_music_id && !match.apple_music_url && !match.youtube_id && !match.youtube_url && match.share_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => window.open(match.share_url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Details
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No matches found for this beat</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BatchResults;
