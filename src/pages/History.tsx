import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Music, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")} size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Beat History</h1>
        </div>

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
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                      >
                        <div>
                          <p className="font-medium">{match.song_title}</p>
                          <p className="text-sm text-muted-foreground">
                            {match.artist}
                            {match.album && ` • ${match.album}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {match.source}
                            {match.confidence &&
                              ` • ${(match.confidence * 100).toFixed(0)}% match`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {match.spotify_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(match.spotify_url, "_blank")
                              }
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
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
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Apple
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
