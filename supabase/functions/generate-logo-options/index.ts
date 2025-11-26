import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const logoPrompts = [
      // Design 1: Modern Minimalist
      "Create a modern minimalist logo for 'PulseFind' music platform. Combine a bold stylized letter 'P' with a clean pulse waveform line. Use vibrant cyan to purple gradient (#00D4FF to #7B61FF). Square icon format with rounded corners, simple geometric shapes, ultra clean lines, professional, works at small sizes. No text.",
      
      // Design 2: Music Industry Bold
      "Create a bold music industry logo for 'PulseFind'. Stylized 'P' integrated with dynamic pulse/heartbeat waveform. Inspired by Beatstars and Spotify aesthetics. Cyan-purple gradient (#00D4FF to #7B61FF). Energetic, iconic, professional square app icon. Clean vector style, no text.",
      
      // Design 3: Tech-Focused
      "Create a tech-focused logo for 'PulseFind' music tech platform. Geometric letter 'P' with digital pulse wave flowing through it. Neon cyan to electric purple gradient (#00D4FF to #7B61FF). Futuristic, sleek, modern square icon. Sharp lines, tech aesthetic, no text.",
      
      // Design 4: Abstract Artistic
      "Create an artistic abstract logo for 'PulseFind'. Stylized 'P' shape merging with flowing organic pulse waveform. Vibrant gradient cyan to purple (#00D4FF to #7B61FF). Creative, memorable, professional square app icon. Smooth curves, artistic yet clean, no text.",
      
      // Design 5: Bold & Playful
      "Create a bold playful logo for 'PulseFind' music app. Strong letter 'P' with energetic zigzag pulse line. Bright cyan-purple gradient (#00D4FF to #7B61FF). Fun, memorable, professional square icon design. Rounded friendly shapes, vibrant, no text."
    ];

    const imagePromises = logoPrompts.map(async (prompt) => {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          messages: [{
            role: 'user',
            content: prompt
          }],
          modalities: ['image', 'text']
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        throw new Error('No image generated');
      }

      return imageUrl;
    });

    const imageUrls = await Promise.all(imagePromises);

    return new Response(
      JSON.stringify({ logos: imageUrls }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in generate-logo-options function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
