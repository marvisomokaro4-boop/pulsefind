import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for public endpoint (10 requests per hour)
    const clientId = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(clientId, 'auto-alert-scan', {
      maxRequests: 10,
      windowMinutes: 60
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

    console.log('🔄 Starting auto-alert scan cycle...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get all users with Pro plan who have auto-alerts enabled
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from('user_subscriptions')
      .select('user_id, profiles!inner(email)')
      .eq('status', 'active')
      .neq('plan_id', (await supabaseClient
        .from('subscription_plans')
        .select('id')
        .eq('name', 'Free')
        .single()
      ).data?.id);

    if (subsError) throw subsError;

    console.log(`Found ${subscriptions?.length || 0} Pro users to scan`);

    // Get all beats for these users
    const userIds = subscriptions?.map(s => s.user_id) || [];
    
    if (userIds.length === 0) {
      console.log('No Pro users found, skipping scan');
      return new Response(
        JSON.stringify({ message: 'No Pro users to scan' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: beats, error: beatsError } = await supabaseClient
      .from('beats')
      .select('*')
      .in('user_id', userIds);

    if (beatsError) throw beatsError;

    console.log(`Found ${beats?.length || 0} beats to re-scan`);

    let newMatchesFound = 0;
    const alertsToSend: Array<{userId: string, email: string, beatName: string, newMatches: any[]}> = [];

    // For each beat, re-scan and compare with previous results
    for (const beat of beats || []) {
      console.log(`Re-scanning beat: ${beat.file_name}`);
      
      // Get previous matches for this beat
      const { data: previousMatches } = await supabaseClient
        .from('beat_matches')
        .select('song_title, artist')
        .eq('beat_id', beat.id);

      const previousMatchSet = new Set(
        previousMatches?.map(m => `${m.song_title}|||${m.artist}`) || []
      );

      // Query fingerprint database for cached matches
      const { data: cachedMatches, error: cacheError } = await supabaseClient
        .from('beat_fingerprints')
        .select('*')
        .gte('confidence_score', 50)
        .order('popularity', { ascending: false });

      if (cacheError) {
        console.error('Error fetching cached matches:', cacheError);
        continue;
      }

      // Find new matches (not in previous results)
      const newMatches = cachedMatches?.filter(match => {
        const matchKey = `${match.song_title}|||${match.artist}`;
        return !previousMatchSet.has(matchKey);
      }) || [];

      if (newMatches.length > 0) {
        console.log(`Found ${newMatches.length} new matches for ${beat.file_name}`);
        newMatchesFound += newMatches.length;

        // Store new matches in beat_matches table
        for (const match of newMatches) {
          await supabaseClient
            .from('beat_matches')
            .insert({
              beat_id: beat.id,
              song_title: match.song_title,
              artist: match.artist,
              album: match.album,
              confidence: match.confidence_score,
              source: match.source || 'acrcloud',
              spotify_id: match.spotify_id,
              spotify_url: match.spotify_url,
              apple_music_id: match.apple_music_id,
              apple_music_url: match.apple_music_url,
              youtube_id: match.youtube_id,
              youtube_url: match.youtube_url,
              album_cover_url: match.album_cover_url,
              preview_url: match.preview_url,
              popularity: match.popularity,
            });
        }

        // Queue alert email
        const userSub = subscriptions?.find(s => s.user_id === beat.user_id);
        if (userSub) {
          alertsToSend.push({
            userId: beat.user_id,
            email: (userSub.profiles as any).email,
            beatName: beat.file_name,
            newMatches: newMatches.slice(0, 5), // Top 5 matches
          });
        }
      }
    }

    // Send alert emails
    for (const alert of alertsToSend) {
      try {
        await supabaseClient.functions.invoke('send-alert-email', {
          body: alert,
        });
        console.log(`Alert email sent to ${alert.email}`);
      } catch (emailError) {
        console.error(`Failed to send alert to ${alert.email}:`, emailError);
      }
    }

    console.log(`✅ Auto-alert scan complete. Found ${newMatchesFound} new matches, sent ${alertsToSend.length} alerts`);

    return new Response(
      JSON.stringify({ 
        message: 'Auto-alert scan complete',
        beatsScanned: beats?.length || 0,
        newMatchesFound,
        alertsSent: alertsToSend.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Auto-alert scan error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
