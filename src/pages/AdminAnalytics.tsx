import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Database, Activity, Users, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlatformStats {
  platform: string;
  count: number;
}

interface SongReport {
  song_title: string;
  artist: string;
  report_count: number;
  platforms: string[];
}

interface PromoStats {
  total_users: number;
  promo_users_count: number;
  remaining_spots: number;
}

const AdminAnalytics = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [topReportedSongs, setTopReportedSongs] = useState<SongReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [promoStats, setPromoStats] = useState<PromoStats | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      toast({
        title: "Access Denied",
        description: "You don't have admin access to this page.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    loadAnalytics();
    loadPromoStats();
  };

  const loadAnalytics = async () => {
    // Get all reports (admins can see all)
    const { data: reports, error } = await supabase
      .from("missing_link_reports")
      .select("*")
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Error loading reports:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
      return;
    }

    setTotalReports(reports?.length || 0);

    // Calculate platform statistics
    const platformCounts = reports?.reduce((acc, report) => {
      acc[report.reported_platform] = (acc[report.reported_platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const platformStatsArray = Object.entries(platformCounts || {}).map(([platform, count]) => ({
      platform,
      count: count as number,
    })).sort((a, b) => b.count - a.count);

    setPlatformStats(platformStatsArray);

    // Find most reported songs
    const songCounts = reports?.reduce((acc, report) => {
      const key = `${report.song_title}|||${report.artist}`;
      if (!acc[key]) {
        acc[key] = {
          song_title: report.song_title,
          artist: report.artist,
          report_count: 0,
          platforms: new Set<string>(),
        };
      }
      acc[key].report_count++;
      acc[key].platforms.add(report.reported_platform);
      return acc;
    }, {} as Record<string, any>);

    const topSongs = Object.values(songCounts || {})
      .map((item: any) => ({
        ...item,
        platforms: Array.from(item.platforms),
      }))
      .sort((a: any, b: any) => b.report_count - a.report_count)
      .slice(0, 10);

    setTopReportedSongs(topSongs as SongReport[]);
  };

  const loadPromoStats = async () => {
    try {
      // Get total user count
      const { count: totalUsers, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      // Get Pro plan ID
      const { data: proPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("name", "Pro")
        .single();

      if (!proPlan) {
        console.error("Pro plan not found");
        return;
      }

      // Count users with promotional Pro subscriptions (first 100)
      // These are subscriptions with 3-month period from signup
      const { count: promoCount, error: promoError } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", proPlan.id)
        .eq("status", "active")
        .not("current_period_end", "is", null);

      if (promoError) throw promoError;

      setPromoStats({
        total_users: totalUsers || 0,
        promo_users_count: promoCount || 0,
        remaining_spots: Math.max(0, 100 - (totalUsers || 0)),
      });
    } catch (error) {
      console.error("Error loading promo stats:", error);
      toast({
        title: "Error",
        description: "Failed to load promotional statistics.",
        variant: "destructive",
      });
    }
  };

  const handleRunBatchCheck = async () => {
    setIsRunningBatch(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recheck-missing-links`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Batch Check Complete",
          description: `Re-checked ${data.checked} reports, found ${data.updated} new links.`,
        });
        loadAnalytics(); // Reload data
      } else {
        throw new Error(data.error || "Batch check failed");
      }
    } catch (error) {
      console.error("Error running batch check:", error);
      toast({
        title: "Error",
        description: "Failed to run batch check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunningBatch(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Analytics</h1>
              <p className="text-sm text-muted-foreground">Promotional Stats & Missing Link Reports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Promotional Stats */}
        {promoStats && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-2xl font-bold">Launch Promotion Tracker</h2>
                <p className="text-sm text-muted-foreground">First 100 Users Get Pro Free for 3 Months</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Total Signups</p>
                </div>
                <p className="text-4xl font-bold">{promoStats.total_users}</p>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Crown className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Promo Claims</p>
                </div>
                <p className="text-4xl font-bold text-primary">{promoStats.promo_users_count}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  out of 100 spots
                </p>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Spots Remaining</p>
                </div>
                <p className="text-4xl font-bold text-green-600">{promoStats.remaining_spots}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Promotion Progress</span>
                <span className="font-semibold">{Math.min(promoStats.total_users, 100)}/100</span>
              </div>
              <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  style={{
                    width: `${Math.min((promoStats.total_users / 100) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-3xl font-bold">{totalReports}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Songs</p>
                <p className="text-3xl font-bold">{topReportedSongs.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platforms</p>
                <p className="text-3xl font-bold">{platformStats.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Batch Processing */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Batch Processing</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Re-check recently reported missing links to find newly available matches on Apple Music.
          </p>
          <Button
            onClick={handleRunBatchCheck}
            disabled={isRunningBatch}
          >
            {isRunningBatch ? "Running..." : "Run Batch Check"}
          </Button>
        </Card>

        {/* Platform Statistics */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Reports by Platform</h2>
          <div className="space-y-4">
            {platformStats.map((stat) => (
              <div key={stat.platform} className="flex items-center justify-between">
                <span className="font-medium">{stat.platform}</span>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${(stat.count / totalReports) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {stat.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Most Reported Songs */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Most Reported Songs</h2>
          <div className="space-y-4">
            {topReportedSongs.map((song, index) => (
              <div key={`${song.song_title}-${song.artist}`} className="border-b border-border pb-4 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-semibold">{song.song_title}</p>
                        <p className="text-sm text-muted-foreground">{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {song.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="text-xs px-2 py-1 rounded bg-muted"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {song.report_count} {song.report_count === 1 ? "report" : "reports"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
};

export default AdminAnalytics;