import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    // Create client with anon key and user's authorization header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        },
        auth: { persistSession: false }
      }
    );

    logStep("Authenticating user");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // First check database for any active subscription (including manually assigned and forever access)
    const { data: dbSubscription } = await supabaseClient
      .from("user_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
      .single();

    if (dbSubscription) {
      logStep("Found active subscription in database", { 
        plan: dbSubscription.subscription_plans.name,
        scansPerDay: dbSubscription.subscription_plans.scans_per_day 
      });
      
      return new Response(JSON.stringify({ 
        subscribed: true,
        plan: dbSubscription.subscription_plans.name,
        scans_per_day: dbSubscription.subscription_plans.scans_per_day,
        subscription_end: dbSubscription.current_period_end
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active database subscription found, checking Stripe");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning Free plan");
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: "Free",
        scans_per_day: 3
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let planName = "Free";
    let scansPerDay = 3;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const priceId = subscription.items.data[0].price.id;
      logStep("Active subscription found", { subscriptionId: subscription.id, priceId, endDate: subscriptionEnd });
      
      // Get plan details from database
      const { data: plan } = await supabaseClient
        .from("subscription_plans")
        .select("*")
        .eq("stripe_price_id", priceId)
        .single();

      if (plan) {
        planName = plan.name;
        scansPerDay = plan.scans_per_day;
        logStep("Found plan in database", { planName, scansPerDay });

        // Update user_subscriptions table
        await supabaseClient
          .from("user_subscriptions")
          .upsert({
            user_id: user.id,
            plan_id: plan.id,
            status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            current_period_end: subscriptionEnd,
          });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan: planName,
      scans_per_day: scansPerDay,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});