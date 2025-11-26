import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-PROMO-STATS] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for public promo stats endpoint (30 requests per 15 minutes)
    const clientId = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(clientId, 'get-promo-stats', {
      maxRequests: 30,
      windowMinutes: 15
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          resetAt: rateLimit.resetAt 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep("Function started");

    // Create a Supabase client with service role key to bypass RLS for counting
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get total user count
    const { count: totalUsers, error: countError } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (countError) {
      logStep("Error counting users", { error: countError });
      throw countError;
    }

    logStep("User count retrieved", { totalUsers });

    // Calculate remaining spots (max 100 promotional spots, starting from user 3)
    // Users 1-2 are excluded, users 3-102 get the promo (100 total spots)
    const PROMO_LIMIT = 100;
    const PROMO_START_USER = 3; // Start from user 3 (skip first 2)
    const PROMO_END_USER = PROMO_START_USER + PROMO_LIMIT - 1; // User 102
    
    // Calculate how many promo spots have been claimed
    const claimedSpots = Math.max(0, Math.min(PROMO_LIMIT, (totalUsers || 0) - (PROMO_START_USER - 1)));
    const remainingSpots = Math.max(0, PROMO_LIMIT - claimedSpots);
    const promoActive = (totalUsers || 0) < PROMO_END_USER;

    logStep("Calculated stats", { totalUsers, claimedSpots, remainingSpots, promoActive });

    return new Response(
      JSON.stringify({
        total_users: totalUsers || 0,
        claimed_spots: claimedSpots,
        remaining_spots: remainingSpots,
        promo_limit: PROMO_LIMIT,
        promo_active: promoActive,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in get-promo-stats", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});