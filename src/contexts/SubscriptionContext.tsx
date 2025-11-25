import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionContextType {
  plan: string;
  scansPerDay: number;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  plan: 'Free',
  scansPerDay: 3,
  isLoading: true,
  refreshSubscription: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [plan, setPlan] = useState('Free');
  const [scansPerDay, setScansPerDay] = useState(3);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscription = async () => {
    try {
      // First, get and validate the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // No valid session, use Free tier
        setPlan('Free');
        setScansPerDay(3);
        setIsLoading(false);
        return;
      }

      // Check if session is about to expire (within 5 minutes)
      const expiresAt = session.expires_at || 0;
      const now = Math.floor(Date.now() / 1000);
      const fiveMinutes = 5 * 60;

      if (expiresAt - now < fiveMinutes) {
        // Session is expiring soon, refresh it
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error('Session refresh failed:', refreshError);
          // Sign out to clear stale session
          await supabase.auth.signOut();
          setPlan('Free');
          setScansPerDay(3);
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        
        // If we get an auth error, the session is completely invalid
        if (error.message?.includes('Auth') || error.message?.includes('session')) {
          console.log('Invalid session detected, signing out...');
          // Sign out to clear stale session and force fresh login
          await supabase.auth.signOut();
          setPlan('Free');
          setScansPerDay(3);
          setIsLoading(false);
          return;
        }
        
        setPlan('Free');
        setScansPerDay(3);
      } else if (data) {
        setPlan(data.plan || 'Free');
        setScansPerDay(data.scans_per_day || 3);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      setPlan('Free');
      setScansPerDay(3);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        refreshSubscription();
      } else if (event === 'SIGNED_OUT') {
        setPlan('Free');
        setScansPerDay(3);
        setIsLoading(false);
      }
    });

    // Refresh every 60 seconds
    const interval = setInterval(refreshSubscription, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <SubscriptionContext.Provider value={{ plan, scansPerDay, isLoading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};