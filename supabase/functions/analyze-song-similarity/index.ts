import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matches } = await req.json();
    
    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ similar: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Create a summary of the matches for AI analysis
    const matchesSummary = matches.map((m: any) => 
      `${m.title} by ${m.artist}${m.album ? ` (${m.album})` : ''}`
    ).join('\n');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a music expert. Analyze the provided songs and identify their common characteristics (genre, style, tempo, mood, era). Then suggest 5 similar songs that match these characteristics but are NOT in the provided list."
          },
          {
            role: "user",
            content: `Here are the songs that use this beat:\n${matchesSummary}\n\nBased on these songs, suggest 5 similar songs with the same vibe/genre that would appeal to fans of these tracks.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_similar_songs",
              description: "Return 5 similar song suggestions",
              parameters: {
                type: "object",
                properties: {
                  analysis: {
                    type: "string",
                    description: "Brief analysis of the common characteristics"
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        artist: { type: "string" },
                        reason: { type: "string", description: "Why this song is similar" }
                      },
                      required: ["title", "artist", "reason"]
                    },
                    minItems: 5,
                    maxItems: 5
                  }
                },
                required: ["analysis", "suggestions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_similar_songs" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ similar: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify({
      analysis: result.analysis,
      similar: result.suggestions
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error analyzing similarity:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});