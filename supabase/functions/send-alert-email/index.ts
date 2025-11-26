import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertEmailRequest {
  userId: string;
  email: string;
  beatName: string;
  newMatches: Array<{
    song_title: string;
    artist: string;
    spotify_url?: string;
    apple_music_url?: string;
    youtube_url?: string;
    confidence_score: number;
    popularity?: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, beatName, newMatches }: AlertEmailRequest = await req.json();

    const matchesHtml = newMatches.map((match, index) => `
      <div style="margin: 15px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #6366f1; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937;">${index + 1}. ${match.song_title}</h3>
        <p style="margin: 4px 0; color: #6b7280;">Artist: <strong>${match.artist}</strong></p>
        <p style="margin: 4px 0; color: #6b7280;">Match Confidence: <strong>${match.confidence_score}%</strong></p>
        ${match.popularity ? `<p style="margin: 4px 0; color: #6b7280;">Popularity: <strong>${match.popularity}/100</strong></p>` : ''}
        <div style="margin-top: 10px;">
          ${match.spotify_url ? `<a href="${match.spotify_url}" style="display: inline-block; margin-right: 10px; padding: 8px 16px; background: #1DB954; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">Open in Spotify</a>` : ''}
          ${match.apple_music_url ? `<a href="${match.apple_music_url}" style="display: inline-block; margin-right: 10px; padding: 8px 16px; background: #FA243C; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">Open in Apple Music</a>` : ''}
          ${match.youtube_url ? `<a href="${match.youtube_url}" style="display: inline-block; padding: 8px 16px; background: #FF0000; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">Open in YouTube</a>` : ''}
        </div>
      </div>
    `).join('');

    const emailResponse = await resend.emails.send({
      from: 'PulseFind <alerts@resend.dev>',
      to: [email],
      subject: `🎵 New matches found for "${beatName}"`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎵 New Beat Matches Found!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #1f2937; margin-top: 0;">
                Great news! We've found <strong>${newMatches.length} new song${newMatches.length !== 1 ? 's' : ''}</strong> using your beat:
              </p>
              
              <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <h2 style="margin: 0; color: #1e40af; font-size: 18px;">📀 ${beatName}</h2>
              </div>

              <h3 style="color: #1f2937; margin-top: 30px; margin-bottom: 15px;">Newly Detected Songs:</h3>
              ${matchesHtml}

              <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 15px 0; color: #6b7280;">View all matches and download evidence packages:</p>
                <a href="${Deno.env.get('SITE_URL') || 'https://pulsefind.lovable.app'}/history" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View in PulseFind</a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
                <p>These automatic alerts are part of your Pro subscription. We scan your beats regularly to detect new usage across platforms.</p>
                <p style="margin-top: 15px;">
                  <a href="${Deno.env.get('SITE_URL') || 'https://pulsefind.lovable.app'}/settings" style="color: #6366f1; text-decoration: none;">Manage alert settings</a>
                </p>
              </div>
            </div>

            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} PulseFind - Beat Usage Detection Platform</p>
              <p style="margin-top: 5px;">
                <a href="${Deno.env.get('SITE_URL') || 'https://pulsefind.lovable.app'}" style="color: #6b7280; text-decoration: none;">pulsefind.lovable.app</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Alert email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error sending alert email:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send alert email',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
