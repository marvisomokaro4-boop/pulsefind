import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/contexts/SubscriptionContext';

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { plan: currentPlan, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      scans: '3 scans/day',
      features: [
        'Basic recognition',
        'Song title, artist, match score',
        'Limited preview of results',
      ],
      cta: 'Current Plan',
      priceId: null,
    },
    {
      name: 'Pro',
      price: '$10',
      period: 'per month',
      scans: '50 scans/day',
      features: [
        'Full recognition with confidence score',
        'Similar song / vibe matching',
        'Sample / copyright detection',
        '7-day free trial',
      ],
      cta: 'Upgrade to Pro',
      priceId: null, // Will be set after Stripe product creation
      popular: true,
    },
    {
      name: 'Elite',
      price: '$20',
      period: 'per month',
      scans: 'Unlimited scans',
      features: [
        'Everything in Pro',
        'Bulk upload / scan',
        'Notifications if beat is used',
        'Priority support',
      ],
      cta: 'Upgrade to Elite',
      priceId: null, // Will be set after Stripe product creation
    },
  ];

  const handleSubscribe = async (planName: string, priceId: string | null) => {
    if (!priceId) {
      toast({
        title: 'Coming Soon',
        description: 'Stripe integration is being configured. Please check back soon!',
      });
      return;
    }

    setLoading(planName);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        
        // Wait a moment then refresh subscription status
        setTimeout(() => {
          refreshSubscription();
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Error',
        description: 'Failed to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading('manage');
    
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: 'Error',
        description: 'Failed to open subscription management. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">
            Unlock powerful beat recognition features
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {plans.map((plan) => {
            const isCurrentPlan = plan.name === currentPlan;
            const isPaidPlan = plan.name !== 'Free';

            return (
              <Card
                key={plan.name}
                className={`relative p-8 ${
                  plan.popular ? 'border-primary border-2 shadow-lg scale-105' : ''
                } ${isCurrentPlan ? 'border-green-500 border-2' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Your Plan
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-2">{plan.period}</span>
                  </div>
                  <p className="text-primary font-medium">{plan.scans}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={isCurrentPlan || loading !== null}
                  onClick={() => handleSubscribe(plan.name, plan.priceId)}
                >
                  {loading === plan.name ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    plan.cta
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {currentPlan !== 'Free' && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={loading === 'manage'}
            >
              {loading === 'manage' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Manage Subscription'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricing;