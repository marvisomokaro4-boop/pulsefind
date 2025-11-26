import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract ID from user-provided URL
function extractIdFromUrl(url: string, platform: string): string | null {
  if (!url) return null;
  
  try {
    switch (platform) {
      case 'Spotify':
        // Spotify: https://open.spotify.com/track/TRACK_ID
        const spotifyMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        return spotifyMatch ? spotifyMatch[1] : null;
        
      case 'Apple Music':
        // Apple Music: https://music.apple.com/us/album/ALBUM/TRACK_ID
        const appleMatch = url.match(/music\.apple\.com\/[a-z]{2}\/(?:album|song)\/[^/]+\/(\d+)/);
        return appleMatch ? appleMatch[1] : null;
        
      case 'YouTube':
        // YouTube: https://www.youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        return youtubeMatch ? youtubeMatch[1] : null;
        
      default:
        return null;
    }
  } catch (error) {
    console.error('Error extracting ID from URL:', error);
    return null;
  }
}

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
      const platform = report.reported_platform;
      let foundId: string | null = null;
      
      // First, try to extract ID from user-provided URL
      if (report.user_provided_url) {
        foundId = extractIdFromUrl(report.user_provided_url, platform);
        if (foundId) {
          console.log(`✓ Extracted ${platform} ID from user URL: ${foundId}`);
        }
      }
      
      // If no user URL, try API search (currently only for Apple Music)
      if (!foundId && platform === 'Apple Music') {
        foundId = await searchAppleMusic(report.song_title, report.artist);
      }
      
      if (foundId) {
        console.log(`Found ${platform} ID for "${report.song_title}": ${foundId}`);
        
        // Prepare updates based on platform
        const reportUpdate: any = {};
        const matchUpdate: any = {};
        
        switch (platform) {
          case 'Spotify':
            reportUpdate.spotify_id = foundId;
            matchUpdate.spotify_id = foundId;
            matchUpdate.spotify_url = `https://open.spotify.com/track/${foundId}`;
            break;
          case 'Apple Music':
            reportUpdate.apple_music_id = foundId;
            matchUpdate.apple_music_id = foundId;
            matchUpdate.apple_music_url = `https://music.apple.com/us/song/${foundId}`;
            break;
          case 'YouTube':
            reportUpdate.youtube_id = foundId;
            matchUpdate.youtube_id = foundId;
            matchUpdate.youtube_url = `https://www.youtube.com/watch?v=${foundId}`;
            break;
        }
        
        // Update the report
        updates.push(
          supabaseClient
            .from('missing_link_reports')
            .update(reportUpdate)
            .eq('id', report.id)
        );
        
        // If there's a beat_match_id, update that too
        if (report.beat_match_id && Object.keys(matchUpdate).length > 0) {
          updates.push(
            supabaseClient
              .from('beat_matches')
              .update(matchUpdate)
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