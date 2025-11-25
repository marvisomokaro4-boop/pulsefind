import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music2, LogOut, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BeatInput from "@/components/BeatInput";
import SongResults from "@/components/SongResults";
import BatchResults from "@/components/BatchResults";
import { useToast } from "@/hooks/use-toast";

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

const Index = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [batchResults, setBatchResults] = useState<BeatResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleMatchesFound = (foundMatches: Match[]) => {
    setMatches(foundMatches);
    setBatchResults([]);
    setHasSearched(true);
  };

  const handleBatchResults = (results: BeatResult[]) => {
    setBatchResults(results);
    setMatches([]);
    setHasSearched(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">BeatMatch</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/history")}
            >
              <HistoryIcon className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-2xl bg-card border border-primary/30 shadow-[0_0_30px_hsl(180_100%_50%/0.3)]">
                <Music2 className="w-16 h-16 text-primary" />
              </div>
            </div>
            <h1 className="text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              BeatMatch
            </h1>
            <p className="text-2xl text-muted-foreground mb-4">
              Discover Who's Using Your Beats
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your producer beat and find all the songs using it across Spotify, Apple Music, and more.
            </p>
          </div>
        </div>
        
        {/* Animated wave bars */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end gap-1 h-16 opacity-30 px-4">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-t"
              style={{
                animation: `wave 1s ease-in-out infinite`,
                animationDelay: `${i * 0.02}s`,
                height: `${Math.random() * 60 + 10}%`,
              }}
            />
          ))}
        </div>
      </section>

      {/* Beat Input Section */}
      <section className="container mx-auto px-4 py-16">
        <BeatInput 
          onMatchesFound={handleMatchesFound}
          onBatchResults={handleBatchResults}
        />
      </section>

      {/* Results Section */}
      {hasSearched && (
        <section className="container mx-auto px-4 pb-16">
          {matches.length > 0 && <SongResults matches={matches} />}
          {batchResults.length > 0 && <BatchResults results={batchResults} />}
        </section>
      )}
    </main>
  );
};

export default Index;
