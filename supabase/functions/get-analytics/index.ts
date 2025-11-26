import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GET-ANALYTICS] Function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    console.log('[GET-ANALYTICS] User authenticated:', user.id);
    
    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    const isAdmin = roleData?.role === 'admin';
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get query parameters
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    console.log('[GET-ANALYTICS] Fetching analytics for last', days, 'days');
    
    // Fetch analytics data
    const { data: scans, error: scanError } = await supabase
      .from('scan_analytics')
      .select('*')
      .gte('scan_date', startDate.toISOString())
      .order('scan_date', { ascending: false });
    
    if (scanError) {
      throw scanError;
    }
    
    // Calculate summary statistics
    const totalScans = scans.length;
    const noResultScans = scans.filter(s => s.total_matches_found === 0).length;
    const avgConfidence = scans
      .filter(s => s.avg_confidence_score)
      .reduce((sum, s) => sum + parseFloat(s.avg_confidence_score), 0) / (totalScans || 1);
    const avgDuration = scans.reduce((sum, s) => sum + s.total_duration_ms, 0) / (totalScans || 1);
    const avgQuality = scans
      .filter(s => s.audio_quality_score)
      .reduce((sum, s) => sum + parseFloat(s.audio_quality_score), 0) / (totalScans || 1);
    
    // Platform breakdown
    const platformStats = {
      acrcloud: scans.reduce((sum, s) => sum + s.acrcloud_matches, 0),
      youtube: scans.reduce((sum, s) => sum + s.youtube_matches, 0),
      spotify: scans.reduce((sum, s) => sum + s.spotify_matches, 0),
      cacheHits: scans.filter(s => s.local_cache_hit).length
    };
    
    // Error analysis
    const errorCounts: { [key: string]: number } = {};
    scans.forEach(s => {
      if (s.error_messages && s.error_messages.length > 0) {
        s.error_messages.forEach((msg: string) => {
          errorCounts[msg] = (errorCounts[msg] || 0) + 1;
        });
      }
    });
    
    // Performance metrics
    const performanceMetrics = {
      avgPreprocessing: scans.reduce((sum, s) => sum + (s.preprocessing_duration_ms || 0), 0) / (totalScans || 1),
      avgFingerprinting: scans.reduce((sum, s) => sum + (s.fingerprint_duration_ms || 0), 0) / (totalScans || 1),
      avgMatching: scans.reduce((sum, s) => sum + (s.matching_duration_ms || 0), 0) / (totalScans || 1)
    };
    
    // Segment success rate
    const totalSegments = scans.reduce((sum, s) => sum + s.segments_analyzed, 0);
    const successfulSegments = scans.reduce((sum, s) => sum + s.segments_successful, 0);
    const segmentSuccessRate = (successfulSegments / totalSegments) * 100;
    
    const summary = {
      period: { days, startDate: startDate.toISOString() },
      overview: {
        totalScans,
        noResultScans,
        noResultPercentage: ((noResultScans / totalScans) * 100).toFixed(2),
        avgConfidence: avgConfidence.toFixed(4),
        avgDuration: Math.round(avgDuration),
        avgQuality: avgQuality.toFixed(4)
      },
      platformStats,
      performanceMetrics: {
        ...performanceMetrics,
        avgTotal: avgDuration
      },
      segmentStats: {
        totalSegments,
        successfulSegments,
        successRate: segmentSuccessRate.toFixed(2)
      },
      errorCounts,
      recentScans: scans.slice(0, 20)
    };
    
    console.log('[GET-ANALYTICS] Analytics computed successfully');
    
    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[GET-ANALYTICS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
