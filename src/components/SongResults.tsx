import { Card } from "@/components/ui/card";
import { Music, ExternalLink, Shield, Play, X, Flag, Lock, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  sources?: string[]; // Multi-source tracking
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
  isAnonymous?: boolean;
}

const SongResults = ({ matches, debugMode = false, searchMode = 'beat', isAnonymous = false }: SongResultsProps) => {
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [minConfidence, setMinConfidence] = useState(40);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [matchingMode, setMatchingMode] = useState<'strict' | 'loose'>('strict');
  const [expandedMatchIndex, setExpandedMatchIndex] = useState<number | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [providedUrl, setProvidedUrl] = useState("");
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

  const openReportDialog = (match: Match, platform: string) => {
    setSelectedMatch(match);
    setSelectedPlatform(platform);
    setProvidedUrl("");
    setReportDialogOpen(true);
  };

  const handleReportMissingLink = async () => {
    if (!selectedMatch || !selectedPlatform) return;

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
          song_title: selectedMatch.title,
          artist: selectedMatch.artist,
          album: selectedMatch.album,
          reported_platform: selectedPlatform,
          spotify_id: selectedMatch.spotify_id,
          apple_music_id: selectedMatch.apple_music_id,
          youtube_id: selectedMatch.youtube_id,
          user_provided_url: providedUrl || null,
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
        description: `Thanks for reporting that "${selectedMatch.title}" by ${selectedMatch.artist} is available on ${selectedPlatform}. We'll work on improving our matching.`,
      });
      
      setReportDialogOpen(false);
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
      {/* Anonymous User Banner */}
      {isAnonymous && (
        <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-semibold mb-1">We found {filteredMatches.length} matches!</h3>
              <p className="text-sm text-muted-foreground">
                Create a free account to view full song details, stream counts, confidence scores, and download evidence packages for DMCA takedowns.
              </p>
            </div>
            <Button onClick={() => navigate('/auth')} className="gap-2 flex-shrink-0">
              Sign Up Free
            </Button>
          </div>
        </Card>
      )}
      
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Songs Using Your {searchMode === 'beat' ? 'Beat' : 'Producer Tag'}</h2>
          <p className="text-sm sm:text-base text-white/90">
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
            onClick={() => setExpandedMatchIndex(expandedMatchIndex === index ? null : index)}
            className={`overflow-hidden bg-card transition-all duration-300 group relative shadow-lg hover:shadow-xl cursor-pointer ${
              match.confidence && match.confidence < 70 
                ? 'border-2 border-muted/60 hover:border-muted' 
                : 'border-2 border-primary/20 hover:border-primary/40 hover:scale-[1.02]'
            } ${expandedMatchIndex === index ? 'ring-2 ring-primary' : ''}`}
          >
            {isAnonymous && (
              <div className="absolute inset-0 backdrop-blur-sm bg-background/60 z-10 flex items-center justify-center">
                <div className="text-center p-4">
                  <Lock className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Sign up to view details</p>
                </div>
              </div>
            )}
            <div className="relative aspect-square overflow-hidden">
              <AlbumCover
                albumCoverUrl={match.album_cover_url}
                spotifyId={match.spotify_id}
                title={match.title}
              />
              <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end">
                <Badge
                  variant="secondary" 
                  className={`backdrop-blur-md shadow-md text-white ${
                    match.preview_url 
                      ? 'bg-primary/30 border-primary/40' 
                      : 'bg-muted/80 border-muted'
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
                {(match.cached || (match.sources && match.sources.filter(s => s !== 'ACRCloud').length > 0) || (match.source && match.source !== 'ACRCloud')) && (
                  <Badge 
                    variant="secondary" 
                    className={`backdrop-blur-md shadow-md text-white ${
                      match.cached 
                        ? 'bg-green-500/30 border-green-500/40' 
                        : 'bg-background/90'
                    }`}
                  >
                    {match.cached 
                      ? '⚡ Cached' 
                      : match.sources && match.sources.length > 1 
                        ? `${match.sources.filter(s => s !== 'ACRCloud').join(' + ')}` 
                        : match.source !== 'ACRCloud' ? match.source : ''
                    }
                  </Badge>
                )}
              </div>
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                {match.confidence && (
                  <Badge 
                    variant="secondary" 
                    className={`backdrop-blur-md shadow-md text-white ${
                      match.confidence >= 70 
                        ? 'bg-primary/30 border-primary/40' 
                        : 'bg-muted/80'
                    }`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {Math.round(match.confidence)}%
                  </Badge>
                )}
                {match.segment && (
                  <Badge 
                    variant="secondary" 
                    className="backdrop-blur-md shadow-md bg-blue-500/30 border-blue-500/40 text-white text-xs"
                  >
                    📍 {match.segment}
                  </Badge>
                )}
                {match.match_quality && (
                  <Badge 
                    variant="secondary"
                    className="backdrop-blur-md shadow-md text-white text-xs bg-green-500/30 border-green-500/40"
                  >
                    {match.match_quality === 'high' ? '🎯 High Match' : 
                     match.match_quality === 'medium' ? '⚡ Medium Match' : 
                     '💡 Low Match'}
                  </Badge>
                )}
                {match.popularity !== undefined && match.popularity !== null && (
                  <Badge 
                    variant="secondary" 
                    className="backdrop-blur-md shadow-md bg-accent/30 border-accent/40 text-white"
                  >
                    🔥 {match.popularity}/100
                  </Badge>
                )}
                
                {/* Multi-source badge */}
                {match.sources && match.sources.length > 1 && (
                  <Badge 
                    variant="secondary" 
                    className="backdrop-blur-md shadow-md bg-purple-500/30 border-purple-500/40 text-white text-xs"
                  >
                    🔗 {match.sources.length} Sources
                  </Badge>
                )}
                
                <div className="flex gap-1">
                  {match.spotify_id && (
                    <Badge variant="secondary" className="bg-[#1DB954]/30 backdrop-blur-md shadow-md border-[#1DB954]/40 text-white text-xs">
                      Spotify
                    </Badge>
                  )}
                  {match.apple_music_id && (
                    <Badge variant="secondary" className="bg-[#FA243C]/30 backdrop-blur-md shadow-md border-[#FA243C]/40 text-white text-xs">
                      Apple
                    </Badge>
                  )}
                  {match.youtube_id && (
                    <Badge variant="secondary" className="bg-[#FF0000]/30 backdrop-blur-md shadow-md border-[#FF0000]/40 text-white text-xs">
                      YouTube
                    </Badge>
                  )}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-bold text-lg text-white line-clamp-2 drop-shadow-lg">{match.title}</h3>
                <p className="text-sm text-white/90 line-clamp-1 mt-1 drop-shadow-md">
                  {match.artist}
                </p>
                {match.album && (
                  <p className="text-xs text-white/80 line-clamp-1 mt-1 drop-shadow-md">
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

            {/* Detection Sources Details - Expandable */}
            {expandedMatchIndex === index && (
              <div className="px-4 py-3 bg-primary/5 dark:bg-primary/10 border-t border-primary/20 animate-fade-in">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Detection Sources
                </h4>
                <div className="space-y-2 text-xs">
                  {match.sources && match.sources.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground font-medium">
                        Detected by {match.sources.length} source{match.sources.length !== 1 ? 's' : ''}:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.sources.map((source, idx) => (
                          <Badge 
                            key={idx} 
                            variant="secondary"
                            className={`text-xs ${
                              source === 'ACRCloud' ? 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300' :
                              source === 'YouTube' ? 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300' :
                              source === 'Spotify' ? 'bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300' :
                              source === 'Local Cache' ? 'bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300' :
                              'bg-muted/50 border-muted'
                            }`}
                          >
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300 text-xs">
                        {match.source || 'ACRCloud'}
                      </Badge>
                      {match.cached && (
                        <Badge variant="secondary" className="bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300 text-xs">
                          ⚡ Local Cache
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {match.segment && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-muted-foreground">
                        <span className="font-medium">Segment:</span> {match.segment}
                      </p>
                    </div>
                  )}
                  
                  {match.confidence && (
                    <div className={match.segment ? '' : 'pt-2 border-t border-border/50'}>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Confidence:</span>{' '}
                        <span className={match.confidence >= 70 ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                          {Math.round(match.confidence)}%
                        </span>
                      </p>
                    </div>
                  )}

                  {match.match_quality && (
                    <div>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Match Quality:</span>{' '}
                        <span className="capitalize">{match.match_quality}</span>
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/80 mt-3 pt-2 border-t border-border/50">
                  💡 Click card again to close
                </p>
              </div>
            )}
            
            <div className="p-4 space-y-3">
              {match.preview_url && (
                <div onClick={(e) => e.stopPropagation()}>
                  <AudioPreview 
                    previewUrl={match.preview_url}
                    trackName={match.title}
                  />
                </div>
              )}
              
              {match.spotify_url && (
                <a
                  href={match.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  View Details
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Report Missing Link Button */}
              <div onClick={(e) => e.stopPropagation()}>
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
                      <DropdownMenuItem onClick={() => openReportDialog(match, "Spotify")}>
                        Available on Spotify
                      </DropdownMenuItem>
                    )}
                    {!match.apple_music_url && (
                      <DropdownMenuItem onClick={() => openReportDialog(match, "Apple Music")}>
                        Available on Apple Music
                      </DropdownMenuItem>
                    )}
                    {!match.youtube_url && (
                      <DropdownMenuItem onClick={() => openReportDialog(match, "YouTube")}>
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

      {/* Report Missing Link Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Missing Link</DialogTitle>
            <DialogDescription>
              Help us improve by providing the link to "{selectedMatch?.title}" on {selectedPlatform}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="platform-url">
                {selectedPlatform} Link (Optional)
              </Label>
              <Input
                id="platform-url"
                placeholder={`https://${selectedPlatform.toLowerCase().replace(' ', '')}.com/...`}
                value={providedUrl}
                onChange={(e) => setProvidedUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you have the direct link to this song on {selectedPlatform}, paste it here to help us improve our matching
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReportMissingLink}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SongResults;
