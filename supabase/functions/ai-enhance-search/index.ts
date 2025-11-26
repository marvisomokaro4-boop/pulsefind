import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, existingMatches } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    // Get Spotify token
    let spotifyToken = null;
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
        },
        body: 'grant_type=client_credentials'
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        spotifyToken = tokenData.access_token;
      }
    }

    // Build context from existing matches
    const matchContext = existingMatches && existingMatches.length > 0
      ? `Found ${existingMatches.length} matches: ${existingMatches.slice(0, 3).map((m: any) => `"${m.title}" by ${m.artist}`).join(', ')}`
      : 'No direct fingerprint matches found';

    const systemPrompt = `You are a music identification expert. Analyze beat file names and existing matches to suggest official songs.

Your task:
1. Extract keywords from the file name (artist names, song titles, genre indicators)
2. Identify if this is an instrumental, remix, or producer tag
3. Suggest the most likely official song that uses this beat
4. Return 1-3 highly relevant song suggestions with confidence scores

Focus on finding official vocal versions of instrumentals, and mainstream releases over obscure tracks.`;

    const userPrompt = `File name: "${fileName}"
${matchContext}

Based on this information, what is the most likely official song that uses this beat? Provide specific song title and artist.`;

    console.log('Calling AI to enhance search...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_songs',
              description: 'Return 1-3 song suggestions based on beat analysis',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Official song title' },
                        artist: { type: 'string', description: 'Primary artist name' },
                        confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level' },
                        reasoning: { type: 'string', description: 'Why this is suggested' }
                      },
                      required: ['title', 'artist', 'confidence', 'reasoning'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_songs' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', suggestions: [] }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service unavailable. Please try again later.', suggestions: [] }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.log('No AI suggestions returned');
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments).suggestions;
    console.log(`AI suggested ${suggestions.length} songs`);

    // Search Spotify for each suggestion
    const enhancedSuggestions = await Promise.all(
      suggestions.map(async (suggestion: any) => {
        if (!spotifyToken) {
          return { ...suggestion, spotifyData: null };
        }

        try {
          const searchQuery = encodeURIComponent(`${suggestion.title} ${suggestion.artist}`);
          const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=3`,
            {
              headers: { 'Authorization': `Bearer ${spotifyToken}` }
            }
          );

          if (!searchResponse.ok) {
            return { ...suggestion, spotifyData: null };
          }

          const searchData = await searchResponse.json();
          const topResult = searchData.tracks?.items?.[0];

          if (topResult) {
            return {
              ...suggestion,
              spotifyData: {
                id: topResult.id,
                name: topResult.name,
                artists: topResult.artists.map((a: any) => a.name).join(', '),
                album: topResult.album.name,
                albumArt: topResult.album.images?.[1]?.url || topResult.album.images?.[0]?.url,
                previewUrl: topResult.preview_url,
                spotifyUrl: topResult.external_urls.spotify,
                popularity: topResult.popularity,
                releaseDate: topResult.album.release_date
              }
            };
          }

          return { ...suggestion, spotifyData: null };
        } catch (error) {
          console.error('Error searching Spotify:', error);
          return { ...suggestion, spotifyData: null };
        }
      })
    );

    console.log(`Enhanced ${enhancedSuggestions.filter(s => s.spotifyData).length}/${enhancedSuggestions.length} suggestions with Spotify data`);

    return new Response(
      JSON.stringify({ suggestions: enhancedSuggestions }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-enhance-search:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
