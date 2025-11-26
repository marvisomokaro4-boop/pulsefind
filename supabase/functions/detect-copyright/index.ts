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
    const { matches, beatName } = await req.json();
    
    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ 
        hasCopyright: false,
        analysis: "No matches found to analyze" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Create summary of matches
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
            content: "You are a music copyright expert. Analyze songs to detect potential copyright issues, sample usage, and licensing concerns."
          },
          {
            role: "user",
            content: `Beat: ${beatName}\n\nThis beat was found in these songs:\n${matchesSummary}\n\nAnalyze if this beat likely contains copyrighted samples or elements that could cause copyright issues. Consider: 1) Are these well-known commercial songs? 2) Is the beat likely original or sampled? 3) Any licensing concerns?`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_copyright",
              description: "Analyze copyright and sample detection",
              parameters: {
                type: "object",
                properties: {
                  hasCopyright: {
                    type: "boolean",
                    description: "Whether potential copyright issues detected"
                  },
                  riskLevel: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Risk level of copyright issues"
                  },
                  analysis: {
                    type: "string",
                    description: "Detailed analysis of copyright concerns"
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Recommendations for the producer"
                  }
                },
                required: ["hasCopyright", "riskLevel", "analysis", "recommendations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_copyright" } }
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
      return new Response(JSON.stringify({ 
        hasCopyright: false,
        analysis: "Unable to analyze" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error detecting copyright:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});