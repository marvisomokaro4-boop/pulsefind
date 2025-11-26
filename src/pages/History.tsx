import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BeatLeaderboard } from "@/components/BeatLeaderboard";

interface BeatWithMatches {
  id: string;
  file_name: string;
  uploaded_at: string;
  matches: Array<{
    song_title: string;
    artist: string;
    album?: string;
    confidence?: number;
    source: string;
    spotify_url?: string;
    apple_music_url?: string;
    youtube_url?: string;
    release_date?: string;
  }>;
}

const History = () => {
  const [beats, setBeats] = useState<BeatWithMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadHistory();
  }, []);

  const checkAuthAndLoadHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await loadHistory();
  };

  const loadHistory = async () => {
    try {
      const { data: beatsData, error: beatsError } = await supabase
        .from("beats")
        .select("id, file_name, uploaded_at")
        .order("uploaded_at", { ascending: false });

      if (beatsError) throw beatsError;

      if (beatsData) {
        const beatsWithMatches = await Promise.all(
          beatsData.map(async (beat) => {
            const { data: matchesData } = await supabase
              .from("beat_matches")
              .select("*")
              .eq("beat_id", beat.id);

            return {
              ...beat,
              matches: matchesData || [],
            };
          })
        );

        setBeats(beatsWithMatches);
      }
    } catch (error: any) {
      toast({
        title: "Error loading history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Music className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your beat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" onClick={() => navigate("/")} size="icon">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Beat History</h1>
        </div>

        {/* Beat Leaderboard */}
        <BeatLeaderboard />

        {beats.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur border-primary/20">
            <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No beats tracked yet</h2>
            <p className="text-muted-foreground mb-6">
              Upload your first beat to start tracking songs that use it
            </p>
            <Button onClick={() => navigate("/")}>Upload Beat</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {beats.map((beat) => (
              <Card
                key={beat.id}
                className="p-6 bg-card/50 backdrop-blur border-primary/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{beat.file_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Uploaded {new Date(beat.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {beat.matches.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {beat.matches.length === 1 ? "match" : "matches"}
                    </p>
                  </div>
                </div>

                {beat.matches.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    {beat.matches.map((match, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-background/50 gap-3"
                      >
                        <div>
                          <p className="font-medium">{match.song_title}</p>
                          <p className="text-sm text-muted-foreground">
                            {match.artist}
                            {match.album && ` • ${match.album}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {match.release_date && (
                              <span className="text-xs font-medium text-primary">
                                Released: {new Date(match.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {match.confidence && (
                              <span className="text-xs text-muted-foreground">
                                • {match.confidence.toFixed(0)}% match
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {match.spotify_url && (
                              <Badge variant="outline" className="bg-[#1DB954]/10 border-[#1DB954]/30 text-[#1DB954] text-xs">
                                Spotify
                              </Badge>
                            )}
                            {match.apple_music_url && (
                              <Badge variant="outline" className="bg-[#FA243C]/10 border-[#FA243C]/30 text-[#FA243C] text-xs">
                                Apple Music
                              </Badge>
                            )}
                            {match.youtube_url && (
                              <Badge variant="outline" className="bg-[#FF0000]/10 border-[#FF0000]/30 text-[#FF0000] text-xs">
                                YouTube Music
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {match.spotify_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(match.spotify_url, "_blank")
                              }
                              className="text-xs"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Spotify
                            </Button>
                          )}
                          {match.apple_music_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(match.apple_music_url, "_blank")
                              }
                              className="text-xs"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Apple
                            </Button>
                          )}
                          {match.youtube_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(match.youtube_url, "_blank")
                              }
                              className="text-xs"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              YouTube
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
