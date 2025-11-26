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
  scansPerDay: 1,
  isLoading: true,
  refreshSubscription: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [plan, setPlan] = useState('Free');
  const [scansPerDay, setScansPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAuthError, setHasAuthError] = useState(false);

  const refreshSubscription = async () => {
    // If we've detected an auth error, don't keep trying until user logs in again
    if (hasAuthError) {
      setPlan('Free');
      setScansPerDay(1);
      setIsLoading(false);
      return;
    }

    try {
      // Validate session with server (not just local storage)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // No valid session, use Free tier without calling edge function
        setPlan('Free');
        setScansPerDay(1);
        setIsLoading(false);
        return;
      }

      // Only call edge function if we have a valid authenticated user
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        
        // If we get an auth error, the session is invalid
        if (error.message?.includes('Auth') || error.message?.includes('session')) {
          setHasAuthError(true);
          await supabase.auth.signOut();
          setPlan('Free');
          setScansPerDay(1);
          setIsLoading(false);
          return;
        }
        
        setPlan('Free');
        setScansPerDay(1);
      } else if (data) {
        setPlan(data.plan || 'Free');
        setScansPerDay(data.scans_per_day || 1);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      setPlan('Free');
      setScansPerDay(1);
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
        setScansPerDay(1);
        setIsLoading(false);
      }
    });

    // Only set up refresh interval if we have a session and no auth error
    let interval: NodeJS.Timeout | null = null;
    if (!hasAuthError) {
      // Check every 5 minutes instead of every minute
      interval = setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        // Only refresh if there's an active authenticated user
        if (user) {
          refreshSubscription();
        }
      }, 5 * 60 * 1000); // 5 minutes
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