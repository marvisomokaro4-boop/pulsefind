import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Crown, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PromoStats {
  total_users: number;
  claimed_spots: number;
  remaining_spots: number;
  promo_limit: number;
  promo_active: boolean;
}

export const PromoCounter = () => {
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromoStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPromoStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPromoStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-promo-stats');
      
      if (error) throw error;
      
      setStats(data);
    } catch (error) {
      console.error('Error fetching promo stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats || !stats.promo_active) {
    return null;
  }

  const percentageClaimed = (stats.claimed_spots / stats.promo_limit) * 100;

  return (
    <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 border-primary/30 p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-full bg-primary/20">
          <Crown className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold">Limited Launch Offer!</h3>
          <p className="text-sm text-muted-foreground">First 100 users get Pro free for 3 months</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background/50 rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Claimed</span>
          </div>
          <p className="text-2xl font-bold">{stats.claimed_spots}</p>
        </div>

        <div className="bg-background/50 rounded-lg p-3 border border-green-500/50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Remaining</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.remaining_spots}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Promotion Progress</span>
          <span className="font-semibold">{Math.round(percentageClaimed)}% claimed</span>
        </div>
        <div className="w-full h-3 bg-background/50 rounded-full overflow-hidden border border-border/50">
          <div
            className="h-full bg-gradient-to-r from-primary via-primary to-primary/60 transition-all duration-1000 ease-out"
            style={{ width: `${percentageClaimed}%` }}
          />
        </div>
        
        {stats.remaining_spots <= 20 && (
          <p className="text-xs text-center text-destructive font-semibold animate-pulse pt-1">
            ⚡ Only {stats.remaining_spots} spots left! Sign up now!
          </p>
        )}
      </div>
    </Card>
  );
};