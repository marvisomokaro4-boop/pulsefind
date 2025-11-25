import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to search Apple Music using iTunes Search API
async function searchAppleMusic(title: string, artist: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${searchQuery}&media=music&entity=song&limit=10`
    );
    
    if (!response.ok) {
      console.error('iTunes Search API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const normalizeString = (str: string) => 
        str.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const normalizedTitle = normalizeString(title);
      const normalizedArtist = normalizeString(artist);
      
      for (const result of data.results) {
        const resultTitle = normalizeString(result.trackName || '');
        const resultArtist = normalizeString(result.artistName || '');
        
        const titleMatch = resultTitle.includes(normalizedTitle) || normalizedTitle.includes(resultTitle);
        const artistMatch = resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist);
        
        if (titleMatch && artistMatch) {
          console.log(`✓ Found Apple Music ID: ${result.trackId} for "${title}" by ${artist}`);
          return result.trackId?.toString() || null;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Apple Music:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting batch re-check of missing links...');

    // Get reports from the last 7 days where Apple Music was reported missing
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: reports, error: reportsError } = await supabaseClient
      .from('missing_link_reports')
      .select('*')
      .eq('reported_platform', 'Apple Music')
      .is('apple_music_id', null)
      .gte('reported_at', sevenDaysAgo.toISOString())
      .limit(50); // Process 50 at a time

    if (reportsError) {
      throw reportsError;
    }

    console.log(`Found ${reports?.length || 0} reports to re-check`);

    let updatedCount = 0;
    const updates = [];

    // Re-check each report
    for (const report of reports || []) {
      const appleMusicId = await searchAppleMusic(report.song_title, report.artist);
      
      if (appleMusicId) {
        console.log(`Found Apple Music ID for "${report.song_title}": ${appleMusicId}`);
        
        // Update the report
        updates.push(
          supabaseClient
            .from('missing_link_reports')
            .update({ apple_music_id: appleMusicId })
            .eq('id', report.id)
        );
        
        // If there's a beat_match_id, update that too
        if (report.beat_match_id) {
          const appleMusicUrl = `https://music.apple.com/us/song/${appleMusicId}`;
          updates.push(
            supabaseClient
              .from('beat_matches')
              .update({ 
                apple_music_id: appleMusicId,
                apple_music_url: appleMusicUrl 
              })
              .eq('id', report.beat_match_id)
          );
        }
        
        updatedCount++;
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Execute all updates
    await Promise.all(updates);

    console.log(`Batch re-check complete. Updated ${updatedCount} links.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        checked: reports?.length || 0,
        updated: updatedCount,
        message: `Re-checked ${reports?.length || 0} reports, found ${updatedCount} new links`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in recheck-missing-links function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});