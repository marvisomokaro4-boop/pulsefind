import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIPTION-REMINDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get subscriptions expiring in 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const eightDaysFromNow = new Date();
    eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

    logStep("Checking for expiring subscriptions", { 
      from: sevenDaysFromNow.toISOString(), 
      to: eightDaysFromNow.toISOString() 
    });

    const { data: expiringSubscriptions, error } = await supabaseClient
      .from("user_subscriptions")
      .select(`
        *,
        profiles(email),
        subscription_plans(name)
      `)
      .eq("status", "active")
      .gte("current_period_end", sevenDaysFromNow.toISOString())
      .lt("current_period_end", eightDaysFromNow.toISOString());

    if (error) {
      logStep("Error fetching subscriptions", { error: error.message });
      throw error;
    }

    logStep("Found subscriptions to notify", { count: expiringSubscriptions?.length || 0 });

    // Send email to each user
    const emailPromises = (expiringSubscriptions || []).map(async (sub) => {
      const email = sub.profiles?.email;
      const planName = sub.subscription_plans?.name;
      const expirationDate = new Date(sub.current_period_end).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!email) {
        logStep("Skipping subscription - no email", { userId: sub.user_id });
        return null;
      }

      logStep("Sending email", { email, planName });

      try {
        const emailResponse = await resend.emails.send({
          from: "BeatFinder <onboarding@resend.dev>",
          to: [email],
          subject: `Your ${planName} plan expires in 7 days`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #00ffff;">Subscription Expiring Soon</h1>
              <p>Hello,</p>
              <p>Your <strong>${planName}</strong> subscription will expire on <strong>${expirationDate}</strong>.</p>
              <p>To continue enjoying unlimited beat matching and premium features, please renew your subscription before it expires.</p>
              <a href="${Deno.env.get('SUPABASE_URL')}/pricing" 
                 style="display: inline-block; background: linear-gradient(135deg, #00ffff 0%, #ff00ff 100%); 
                        color: #0a0a0f; padding: 12px 24px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; margin: 20px 0;">
                Renew Now
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you have already renewed, please disregard this message.
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 40px;">
                Best regards,<br>
                The BeatFinder Team
              </p>
            </div>
          `,
        });

        logStep("Email sent successfully", { email, messageId: emailResponse.id });
        return emailResponse;
      } catch (emailError) {
        logStep("Error sending email", { email, error: emailError.message });
        return null;
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r !== null).length;

    logStep("Completed", { total: expiringSubscriptions?.length || 0, successful: successCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successCount,
        total: expiringSubscriptions?.length || 0 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
