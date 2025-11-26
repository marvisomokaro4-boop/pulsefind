import { Card } from "@/components/ui/card";
import { Music, ExternalLink, Shield, Play, X, Flag, Lock, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import ConfidenceFilter from "./ConfidenceFilter";
import AlbumCover from "./AlbumCover";
import AudioPreview from "./AudioPreview";
import { useState } from "react";

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
  popularity?: number;
}

interface SongResultsProps {
  matches: Match[];
}

const SongResults = ({ matches }: SongResultsProps) => {
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan } = useSubscription();

  const FREE_TIER_LIMIT = 5;

  const handleReportMissingLink = async (match: Match, platform: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to report missing links.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("missing_link_reports")
        .insert({
          user_id: user.id,
          song_title: match.title,
          artist: match.artist,
          album: match.album,
          reported_platform: platform,
          spotify_id: match.spotify_id,
          apple_music_id: match.apple_music_id,
          youtube_id: match.youtube_id,
        });

      if (error) {
        console.error("Error saving report:", error);
        toast({
          title: "Error",
          description: "Failed to save report. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Missing Link Reported",
        description: `Thanks for reporting that "${match.title}" by ${match.artist} is available on ${platform}. We'll work on improving our matching.`,
      });
    } catch (error) {
      console.error("Error reporting missing link:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

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

  // Separate high and low confidence matches and sort by popularity (Spotify score)
  const highConfidenceMatches = matches
    .filter(m => !m.confidence || m.confidence >= 70)
    .sort((a, b) => {
      // Sort by popularity first (higher is better), then by confidence
      const popA = a.popularity ?? 0;
      const popB = b.popularity ?? 0;
      if (popB !== popA) return popB - popA;
      return (b.confidence || 0) - (a.confidence || 0);
    });
  const lowConfidenceMatches = matches
    .filter(m => m.confidence && m.confidence < 70)
    .sort((a, b) => {
      const popA = a.popularity ?? 0;
      const popB = b.popularity ?? 0;
      if (popB !== popA) return popB - popA;
      return (b.confidence || 0) - (a.confidence || 0);
    });
  
  // Apply Free tier restrictions
  const isFree = plan === 'Free';
  const isPro = plan === 'Pro';
  
  let displayedMatches = showLowConfidence ? [...highConfidenceMatches, ...lowConfidenceMatches] : highConfidenceMatches;
  
  // Restrict Free users to limited results
  if (isFree && displayedMatches.length > FREE_TIER_LIMIT) {
    displayedMatches = displayedMatches.slice(0, FREE_TIER_LIMIT);
  }
  
  const hasMoreResults = isFree && matches.length > FREE_TIER_LIMIT;

  return (
    <div className="space-y-6">
      <div className="text-center px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Songs Using Your Beat</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Found {highConfidenceMatches.length} high-confidence match{highConfidenceMatches.length !== 1 ? 'es' : ''}
        </p>
      </div>

      <ConfidenceFilter
        showLowConfidence={showLowConfidence}
        onToggle={setShowLowConfidence}
        lowConfidenceCount={lowConfidenceMatches.length}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {displayedMatches.map((match, index) => (
          <Card
            key={`${match.title}-${match.artist}-${index}`}
            className={`overflow-hidden bg-card transition-all group ${
              match.confidence && match.confidence < 70 
                ? 'border-muted/50 opacity-90' 
                : 'border-primary/10 hover:border-primary/30'
            }`}
          >
            <div className="relative aspect-square overflow-hidden">
              <AlbumCover
                albumCoverUrl={match.album_cover_url}
                spotifyId={match.spotify_id}
                title={match.title}
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <Badge 
                  variant="secondary" 
                  className={`backdrop-blur ${
                    match.preview_url 
                      ? 'bg-primary/20 border-primary/30' 
                      : 'bg-muted/60 border-muted'
                  }`}
                >
                  {match.preview_url ? (
                    <>
                      <Play className="w-3 h-3 mr-1 fill-current" />
                      Preview
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      No Preview
                    </>
                  )}
                </Badge>
                <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                  {match.source}
                </Badge>
              </div>
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                {match.confidence && (
                  <Badge 
                    variant="secondary" 
                    className={`backdrop-blur ${
                      match.confidence >= 70 
                        ? 'bg-primary/20' 
                        : 'bg-muted/60'
                    }`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {Math.round(match.confidence)}%
                  </Badge>
                )}
                {match.popularity !== undefined && match.popularity !== null && (
                  <Badge 
                    variant="secondary" 
                    className="backdrop-blur bg-accent/20 border-accent/30"
                  >
                    🔥 {match.popularity}/100
                  </Badge>
                )}
                <div className="flex gap-1">
                  {match.spotify_id && (
                    <Badge variant="secondary" className="bg-[#1DB954]/20 backdrop-blur border-[#1DB954]/30 text-xs">
                      Spotify
                    </Badge>
                  )}
                  {match.apple_music_id && (
                    <Badge variant="secondary" className="bg-[#FA243C]/20 backdrop-blur border-[#FA243C]/30 text-xs">
                      Apple
                    </Badge>
                  )}
                  {match.youtube_id && (
                    <Badge variant="secondary" className="bg-[#FF0000]/20 backdrop-blur border-[#FF0000]/30 text-xs">
                      YouTube
                    </Badge>
                  )}
                </div>
              </div>
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
            
            <div className="p-4 space-y-3">
              {match.preview_url && (
                <AudioPreview 
                  previewUrl={match.preview_url}
                  trackName={match.title}
                />
              )}
              
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

              {match.youtube_url && (
                <a
                  href={match.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-gradient-to-r from-[#FF0000] to-[#CC0000] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Open in YouTube
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {match.share_url && !match.spotify_url && !match.apple_music_url && !match.youtube_url && (
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

              {/* Report Missing Link Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                  >
                    <Flag className="w-3 h-3 mr-2" />
                    Report Missing Link
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {!match.spotify_url && (
                    <DropdownMenuItem onClick={() => handleReportMissingLink(match, "Spotify")}>
                      Available on Spotify
                    </DropdownMenuItem>
                  )}
                  {!match.apple_music_url && (
                    <DropdownMenuItem onClick={() => handleReportMissingLink(match, "Apple Music")}>
                      Available on Apple Music
                    </DropdownMenuItem>
                  )}
                  {!match.youtube_url && (
                    <DropdownMenuItem onClick={() => handleReportMissingLink(match, "YouTube")}>
                      Available on YouTube
                    </DropdownMenuItem>
                  )}
                  {match.spotify_url && match.apple_music_url && match.youtube_url && (
                    <DropdownMenuItem disabled>
                      All platforms detected
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Free Tier Upgrade Prompt */}
      {hasMoreResults && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Lock className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">
                {matches.length - FREE_TIER_LIMIT} More Results Available
              </h3>
              <p className="text-muted-foreground mb-4">
                Upgrade to Pro to see all {matches.length} matches and unlock advanced features
              </p>
            </div>
            <Button onClick={() => navigate('/pricing')} size="lg">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </Card>
      )}

    </div>
  );
};

export default SongResults;
