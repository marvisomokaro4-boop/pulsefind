import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music2, LogOut, History as HistoryIcon, Shield, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BeatInput from "@/components/BeatInput";
import SongResults from "@/components/SongResults";
import BatchResults from "@/components/BatchResults";
import { useToast } from "@/hooks/use-toast";
import { LandingHero } from "@/components/LandingHero";
import { LandingFeatures } from "@/components/LandingFeatures";
import { LandingCTA } from "@/components/LandingCTA";
import { PulseFindLogo } from "@/components/PulseFindLogo";
import { UpgradeModal } from "@/components/UpgradeModal";
import { WelcomeModal } from "@/components/WelcomeModal";
import { PromoCounter } from "@/components/PromoCounter";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [monthlyUploads, setMonthlyUploads] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { plan, scansPerDay, isLoading } = useSubscription();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        checkAdminStatus(session.user.id);
        checkMonthlyUploads(session.user.id);
        checkOnboardingStatus(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        checkAdminStatus(session.user.id);
        checkMonthlyUploads(session.user.id);
        checkOnboardingStatus(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const checkOnboardingStatus = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("has_seen_onboarding")
      .eq("id", userId)
      .single();
    
    // Show welcome modal if user hasn't seen onboarding
    if (data && !data.has_seen_onboarding) {
      setShowWelcomeModal(true);
    }
  };

  const checkMonthlyUploads = async (userId: string) => {
    // Get current month's upload count
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { data } = await supabase
      .from("beats")
      .select("id")
      .eq("user_id", userId)
      .gte("uploaded_at", firstDayOfMonth.toISOString());
    
    setMonthlyUploads(data?.length || 0);
  };

  const checkUploadLimit = (): boolean => {
    if (plan === 'Pro' || scansPerDay === -1) {
      return true; // No limit for Pro users
    }
    
    if (monthlyUploads >= 1) {
      setShowUpgradeModal(true);
      return false;
    }
    
    return true;
  };

  const handleMatchesFound = (foundMatches: Match[]) => {
    setMatches(foundMatches);
    setBatchResults([]);
    setHasSearched(true);
    if (user) {
      checkMonthlyUploads(user.id);
    }
  };

  const handleBatchResults = (results: BeatResult[]) => {
    setBatchResults(results);
    setMatches([]);
    setHasSearched(true);
    if (user) {
      checkMonthlyUploads(user.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  // Show landing page for non-authenticated users
  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <LandingHero />
        
        {/* Promotional Counter */}
        <section className="container mx-auto px-4 -mt-8 mb-8 relative z-10">
          <div className="max-w-2xl mx-auto">
            <PromoCounter />
          </div>
        </section>

        <LandingFeatures />
        <LandingCTA />
      </main>
    );
  }

  // Show app interface for authenticated users
  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <PulseFindLogo size="sm" />
          <div className="flex flex-wrap gap-2 items-center">
            {!isLoading && (
              <Button
                variant={plan === 'Free' ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate("/pricing")}
                className="text-xs sm:text-sm"
              >
                {plan === 'Free' ? (
                  <>
                    <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Upgrade</span>
                    <span className="sm:hidden">Pro</span>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="mr-1 sm:mr-2 text-xs">{plan}</Badge>
                    <span className="hidden sm:inline">{scansPerDay === -1 ? 'Unlimited' : `${scansPerDay}/day`}</span>
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/history")}
              className="text-xs sm:text-sm"
            >
              <HistoryIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="text-xs sm:text-sm"
              >
                <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs sm:text-sm">
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="container mx-auto px-4 py-12 sm:py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6 sm:mb-8">
              <PulseFindLogo size="xl" showText={false} />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-primary bg-clip-text text-transparent">
              PulseFind
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-3 sm:mb-4">
              Discover Who's Using Your Beats
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
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
        {plan === 'Free' && (
          <div className="mb-6 text-center">
            <Badge variant={monthlyUploads >= 1 ? "destructive" : "secondary"}>
              {monthlyUploads}/1 uploads this month
            </Badge>
          </div>
        )}
        <BeatInput 
          onMatchesFound={handleMatchesFound}
          onBatchResults={handleBatchResults}
          checkUploadLimit={checkUploadLimit}
        />
      </section>

      <UpgradeModal 
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
      />

      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

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
