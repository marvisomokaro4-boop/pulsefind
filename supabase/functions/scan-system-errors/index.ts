import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorSummary {
  timestamp: string;
  errorCount: number;
  criticalErrors: number;
  recentErrors: Array<{
    function: string;
    message: string;
    count: number;
    lastOccurred: string;
  }>;
  failedScans: number;
  lowSuccessRate: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting system error scan...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Query scan analytics for errors in last 30 minutes
    const { data: recentScans, error: scansError } = await supabase
      .from('scan_analytics')
      .select('*')
      .gte('created_at', thirtyMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (scansError) {
      console.error('Error fetching scan analytics:', scansError);
      throw scansError;
    }

    console.log(`Found ${recentScans?.length || 0} scans in last 30 minutes`);

    // Analyze errors
    const failedScans = recentScans?.filter(scan => 
      scan.errors_encountered && scan.errors_encountered > 0
    ).length || 0;

    const totalScans = recentScans?.length || 0;
    const successRate = totalScans > 0 ? ((totalScans - failedScans) / totalScans) * 100 : 100;
    const lowSuccessRate = successRate < 80;

    // Group error messages
    const errorMessages: { [key: string]: number } = {};
    recentScans?.forEach(scan => {
      if (scan.error_messages && Array.isArray(scan.error_messages)) {
        scan.error_messages.forEach((msg: string) => {
          errorMessages[msg] = (errorMessages[msg] || 0) + 1;
        });
      }
    });

    const recentErrors = Object.entries(errorMessages)
      .map(([message, count]) => ({
        function: 'identify-beat',
        message: message.substring(0, 200), // Truncate long messages
        count,
        lastOccurred: now.toISOString()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 errors

    const criticalErrors = recentErrors.filter(e => 
      e.message.toLowerCase().includes('failed') || 
      e.message.toLowerCase().includes('error') ||
      e.count > 5
    ).length;

    const errorSummary: ErrorSummary = {
      timestamp: now.toISOString(),
      errorCount: recentErrors.reduce((sum, e) => sum + e.count, 0),
      criticalErrors,
      recentErrors,
      failedScans,
      lowSuccessRate
    };

    console.log('Error summary:', JSON.stringify(errorSummary, null, 2));

    // Store error scan results in database for admin dashboard
    const { error: insertError } = await supabase
      .from('system_error_scans')
      .insert({
        scan_timestamp: now.toISOString(),
        error_count: errorSummary.errorCount,
        critical_errors: errorSummary.criticalErrors,
        failed_scans: errorSummary.failedScans,
        total_scans: totalScans,
        success_rate: successRate,
        low_success_rate: lowSuccessRate,
        error_details: recentErrors
      });

    if (insertError) {
      console.error('Failed to store error scan in database:', insertError);
    } else {
      console.log('✅ Error scan results stored in database for admin dashboard');
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: errorSummary,
        timestamp: now.toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in scan-system-errors:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
