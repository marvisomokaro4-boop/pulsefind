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
  const [hasAuthError, setHasAuthError] = useState(false);

  const refreshSubscription = async () => {
    // If we've detected an auth error, don't keep trying until user logs in again
    if (hasAuthError) {
      setPlan('Free');
      setScansPerDay(3);
      setIsLoading(false);
      return;
    }

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
          setHasAuthError(true);
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
          // Sign out to clear stale session and stop retrying
          setHasAuthError(true);
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
        setHasAuthError(false); // Reset auth error flag on successful sign in
        refreshSubscription();
      } else if (event === 'SIGNED_OUT') {
        setHasAuthError(false); // Reset auth error flag
        setPlan('Free');
        setScansPerDay(3);
        setIsLoading(false);
      }
    });

    // Only set up refresh interval if we don't have an auth error
    let interval: NodeJS.Timeout | null = null;
    if (!hasAuthError) {
      interval = setInterval(refreshSubscription, 60000);
    }

    return () => {
      subscription.unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [hasAuthError]);

  return (
    <SubscriptionContext.Provider value={{ plan, scansPerDay, isLoading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};