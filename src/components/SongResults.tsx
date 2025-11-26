import { Card } from "@/components/ui/card";
import { Music, ExternalLink, Shield, Play, X, Flag, Lock, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchingModeToggle } from "./MatchingModeToggle";
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
import ConfidenceSlider from "./ConfidenceSlider";
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
  match_quality?: 'high' | 'medium' | 'low';
  cached?: boolean;
  segment?: string; // Which segment found this match
  debug_info?: {
    raw_results_count?: number;
    segments_found?: string[];
    filtered_reason?: string;
  };
}

interface SongResultsProps {
  matches: Match[];
  debugMode?: boolean;
  searchMode?: 'beat' | 'producer-tag';
}

const SongResults = ({ matches, debugMode = false, searchMode = 'beat' }: SongResultsProps) => {
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [minConfidence, setMinConfidence] = useState(50);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [matchingMode, setMatchingMode] = useState<'strict' | 'loose'>('strict');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan } = useSubscription();

  // Handle matching mode changes
  const handleModeChange = (mode: 'strict' | 'loose') => {
    setMatchingMode(mode);
    setMinConfidence(mode === 'strict' ? 85 : 40);
  };

  const FREE_TIER_LIMIT = 5;
  
  // Filter by minimum confidence threshold
  const filteredMatches = matches.filter(match => 
    !match.confidence || match.confidence >= minConfidence
  );

  // Sort by popularity first, then confidence
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const popA = a.popularity ?? 0;
    const popB = b.popularity ?? 0;
    if (popB !== popA) return popB - popA;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  const highConfidenceMatches = sortedMatches.filter(match => 
    !match.confidence || match.confidence >= 70
  );
  
  const lowConfidenceMatches = sortedMatches.filter(match => 
    match.confidence && match.confidence < 70
  );

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
  
  // Apply Free tier restrictions
  const isFree = plan === 'Free';
  const isPro = plan === 'Pro';
  
  let displayedMatches = showLowConfidence ? sortedMatches : highConfidenceMatches;
  
  // Restrict Free users to limited results
  if (isFree && displayedMatches.length > FREE_TIER_LIMIT) {
    displayedMatches = displayedMatches.slice(0, FREE_TIER_LIMIT);
  }
  
  const hasMoreResults = isFree && filteredMatches.length > FREE_TIER_LIMIT;

  const handleGenerateEvidencePackage = async () => {
    if (filteredMatches.length === 0) {
      toast({
        title: "No matches",
        description: "No matches available to generate evidence package",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('generate-evidence-package', {
        body: {
          beatName: matches[0]?.title || 'Unknown Beat',
          matches: filteredMatches.map(m => ({
            song_title: m.title,
            artist: m.artist,
            album: m.album,
            confidence: m.confidence || 0,
            spotify_url: m.spotify_url,
            apple_music_url: m.apple_music_url,
            youtube_url: m.youtube_url,
            popularity: m.popularity,
            segment: m.segment,
          })),
          producerName: user?.email?.split('@')[0] || 'Unknown Producer',
        },
      });

      if (response.error) throw response.error;

      // The response.data is already an ArrayBuffer from the edge function
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-package-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Evidence package downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating evidence package:', error);
      toast({
        title: "Error",
        description: "Failed to generate evidence package. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Debug Mode Banner */}
      {debugMode && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">Debug Mode Active</h3>
          </div>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Showing raw ACRCloud results with detailed matching information. This view displays all data returned from the fingerprinting service before filtering.
          </p>
        </Card>
      )}
      
      {/* Cached Results Info Banner */}
      {displayedMatches.some(m => m.cached) && (
        <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-green-900 dark:text-green-100">⚡ Lightning Fast Results</h3>
          </div>
          <p className="text-sm text-green-800 dark:text-green-200">
            {displayedMatches.filter(m => m.cached).length} result{displayedMatches.filter(m => m.cached).length !== 1 ? 's' : ''} found instantly from local fingerprint database. 
            New matches are automatically cached for future speed improvements.
          </p>
        </Card>
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Songs Using Your {searchMode === 'beat' ? 'Beat' : 'Producer Tag'}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Found {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} ({highConfidenceMatches.length} high-confidence)
          </p>
        </div>
        <Button
          onClick={handleGenerateEvidencePackage}
          disabled={isGeneratingPDF || filteredMatches.length === 0}
          className="gap-2 shrink-0"
          size="lg"
        >
          {isGeneratingPDF ? (
            <>
              <FileText className="h-5 w-5 animate-pulse" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Evidence Package
            </>
          )}
        </Button>
      </div>

      
      <MatchingModeToggle 
        mode={matchingMode}
        onModeChange={handleModeChange}
      />

      <ConfidenceSlider
        minConfidence={minConfidence}
        onMinConfidenceChange={setMinConfidence}
        totalMatches={matches.length}
        filteredCount={filteredMatches.length}
      />

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
              <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end">
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
                <Badge 
                  variant="secondary" 
                  className={`backdrop-blur ${
                    match.cached 
                      ? 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300' 
                      : 'bg-background/80'
                  }`}
                >
                  {match.cached ? '⚡ Cached' : match.source}
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
                {match.segment && (
                  <Badge 
                    variant="secondary" 
                    className="backdrop-blur bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs"
                  >
                    📍 {match.segment}
                  </Badge>
                )}
                {match.match_quality && (
                  <Badge 
                    variant="secondary"
                    className={`backdrop-blur text-xs ${
                      match.match_quality === 'high' 
                        ? 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300' 
                        : match.match_quality === 'medium'
                        ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-700 dark:text-yellow-300'
                        : 'bg-orange-500/20 border-orange-500/30 text-orange-700 dark:text-orange-300'
                    }`}
                  >
                    {match.match_quality === 'high' ? '🎯 High Match' : 
                     match.match_quality === 'medium' ? '⚡ Medium Match' : 
                     '💡 Low Match'}
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
            
            {/* Debug Information */}
            {debugMode && match.debug_info && (
              <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-950/50 border-t border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Debug Info</h4>
                <div className="text-xs space-y-1 text-yellow-800 dark:text-yellow-200">
                  {match.debug_info.raw_results_count && (
                    <p>• Raw ACRCloud matches: {match.debug_info.raw_results_count}</p>
                  )}
                  {match.debug_info.segments_found && match.debug_info.segments_found.length > 0 && (
                    <p>• Found in segments: {match.debug_info.segments_found.join(', ')}</p>
                  )}
                  {match.debug_info.filtered_reason && (
                    <p>• Filter status: {match.debug_info.filtered_reason}</p>
                  )}
                </div>
              </div>
            )}
            
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
              Upgrade to Pro
            </Button>
          </div>
        </Card>
      )}

    </div>
  );
};

export default SongResults;
