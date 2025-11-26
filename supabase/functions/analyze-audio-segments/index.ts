import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AudioAnalysisResult {
  recommendedSegments: Array<{
    offset: number;
    percentage: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  audioCharacteristics: {
    estimatedDuration: number;
    complexity: 'simple' | 'moderate' | 'complex';
    hasDistinctivePatterns: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileSize, fileName, deepScan } = await req.json();
    
    console.log(`[AUDIO-ANALYSIS] Analyzing: ${fileName} (${fileSize} bytes, deepScan: ${deepScan})`);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use AI to analyze audio characteristics and recommend optimal segments
    const prompt = `You are an expert audio fingerprinting optimizer for music producer beats.

Given:
- File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)
- File name: ${fileName}
- Scan mode: ${deepScan ? 'Deep (7 segments)' : 'Standard (3 segments)'}

Task: Recommend the optimal segment positions (as percentages 0-100) for ACRCloud fingerprinting.

Producer beats typically have:
- Intro/buildup (0-15%)
- Main drop/hook (20-40%) - MOST DISTINCTIVE
- Bridge/variation (50-70%)
- Final drop/outro (80-100%)

For ${deepScan ? 'DEEP scan (7 segments)' : 'STANDARD scan (3 segments)'}:
- Prioritize segments with distinctive elements (drops, unique melodies, signature sounds)
- Avoid silent/minimal intro sections
- Include the main hook/drop (highest priority)
- Cover different parts to catch variations

Respond with segment recommendations, each with:
1. offset percentage (0-100)
2. reason (why this segment is distinctive)
3. priority (high/medium/low)

Also provide:
- Estimated audio complexity (simple/moderate/complex)
- Whether the beat likely has distinctive patterns

Focus on maximizing fingerprint match accuracy.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'recommend_segments',
            description: 'Recommend optimal audio segments for fingerprinting',
            parameters: {
              type: 'object',
              properties: {
                segments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      percentage: { type: 'number', minimum: 0, maximum: 100 },
                      reason: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] }
                    },
                    required: ['percentage', 'reason', 'priority'],
                    additionalProperties: false
                  }
                },
                complexity: {
                  type: 'string',
                  enum: ['simple', 'moderate', 'complex']
                },
                hasDistinctivePatterns: {
                  type: 'boolean'
                }
              },
              required: ['segments', 'complexity', 'hasDistinctivePatterns'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'recommend_segments' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI rate limit exceeded. Using fallback segments.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Using fallback segments.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call returned from AI');
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    
    // Convert percentages to byte offsets
    const recommendedSegments = analysis.segments.map((seg: any) => ({
      offset: Math.floor(fileSize * (seg.percentage / 100)),
      percentage: seg.percentage,
      reason: seg.reason,
      priority: seg.priority
    }));

    const result: AudioAnalysisResult = {
      recommendedSegments,
      audioCharacteristics: {
        estimatedDuration: Math.floor(fileSize / 16000), // Rough estimate: ~16KB per second
        complexity: analysis.complexity,
        hasDistinctivePatterns: analysis.hasDistinctivePatterns
      }
    };

    console.log(`[AUDIO-ANALYSIS] AI recommended ${recommendedSegments.length} segments`);
    console.log(`[AUDIO-ANALYSIS] Complexity: ${result.audioCharacteristics.complexity}`);
    console.log(`[AUDIO-ANALYSIS] Distinctive patterns: ${result.audioCharacteristics.hasDistinctivePatterns}`);
    
    recommendedSegments.forEach((seg: any, i: number) => {
      console.log(`  ${i + 1}. ${seg.percentage.toFixed(1)}% (${seg.priority}) - ${seg.reason}`);
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUDIO-ANALYSIS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
