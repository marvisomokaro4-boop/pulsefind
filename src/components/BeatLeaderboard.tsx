import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Music, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface BeatStats {
  beat_id: string;
  file_name: string;
  uploaded_at: string;
  match_count: number;
  avg_popularity: number;
  max_popularity: number;
  total_popularity: number;
  top_song: string | null;
  top_artist: string | null;
}

export const BeatLeaderboard = () => {
  const [beatStats, setBeatStats] = useState<BeatStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBeatStats();
  }, []);

  const fetchBeatStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all user's beats with their matches
      const { data: beats, error: beatsError } = await supabase
        .from("beats")
        .select("id, file_name, uploaded_at")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false });

      if (beatsError) throw beatsError;

      if (!beats || beats.length === 0) {
        setBeatStats([]);
        setIsLoading(false);
        return;
      }

      // Get matches for all beats with popularity data
      const { data: matches, error: matchesError } = await supabase
        .from("beat_matches")
        .select("beat_id, popularity, song_title, artist, confidence")
        .in("beat_id", beats.map(b => b.id))
        .not("popularity", "is", null);

      if (matchesError) throw matchesError;

      // Calculate stats for each beat
      const stats: BeatStats[] = beats.map(beat => {
        const beatMatches = matches?.filter(m => m.beat_id === beat.id) || [];
        
        if (beatMatches.length === 0) {
          return {
            beat_id: beat.id,
            file_name: beat.file_name,
            uploaded_at: beat.uploaded_at,
            match_count: 0,
            avg_popularity: 0,
            max_popularity: 0,
            total_popularity: 0,
            top_song: null,
            top_artist: null,
          };
        }

        const popularityScores = beatMatches.map(m => m.popularity || 0);
        const maxPopularity = Math.max(...popularityScores);
        const topMatch = beatMatches.find(m => m.popularity === maxPopularity);

        return {
          beat_id: beat.id,
          file_name: beat.file_name,
          uploaded_at: beat.uploaded_at,
          match_count: beatMatches.length,
          avg_popularity: popularityScores.reduce((a, b) => a + b, 0) / popularityScores.length,
          max_popularity: maxPopularity,
          total_popularity: popularityScores.reduce((a, b) => a + b, 0),
          top_song: topMatch?.song_title || null,
          top_artist: topMatch?.artist || null,
        };
      });

      // Sort by max popularity, then by total popularity
      stats.sort((a, b) => {
        if (b.max_popularity !== a.max_popularity) {
          return b.max_popularity - a.max_popularity;
        }
        return b.total_popularity - a.total_popularity;
      });

      // Only show beats with matches
      setBeatStats(stats.filter(s => s.match_count > 0));
    } catch (error) {
      console.error("Error fetching beat stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Trophy className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    if (index === 1) return "bg-gray-400/20 text-gray-400 border-gray-400/30";
    if (index === 2) return "bg-amber-600/20 text-amber-600 border-amber-600/30";
    return "bg-muted";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Beat Leaderboard
          </CardTitle>
          <CardDescription>
            Your beats ranked by song popularity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (beatStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Beat Leaderboard
          </CardTitle>
          <CardDescription>
            Your beats ranked by song popularity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No beats with popularity data yet</p>
            <p className="text-sm mt-1">Upload beats to see your leaderboard</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Beat Leaderboard
        </CardTitle>
        <CardDescription>
          Your beats ranked by the popularity of songs using them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {beatStats.map((stat, index) => (
          <Card
            key={stat.beat_id}
            className={`p-4 transition-all hover:shadow-md ${
              index < 3 ? 'border-2' : ''
            } ${index === 0 ? 'border-yellow-500/30 bg-yellow-500/5' : ''}
            ${index === 1 ? 'border-gray-400/30 bg-gray-400/5' : ''}
            ${index === 2 ? 'border-amber-600/30 bg-amber-600/5' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getMedalIcon(index) || (
                    <Badge variant="outline" className="w-8 h-8 flex items-center justify-center font-bold">
                      {index + 1}
                    </Badge>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate text-sm">
                    {stat.file_name}
                  </h3>
                  {stat.top_song && (
                    <p className="text-xs text-muted-foreground truncate">
                      Top Song: {stat.top_song} - {stat.top_artist}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {stat.match_count} match{stat.match_count !== 1 ? 'es' : ''}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge className={`${getRankBadge(index)} font-bold`}>
                  🔥 {Math.round(stat.max_popularity)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Avg: {Math.round(stat.avg_popularity)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
