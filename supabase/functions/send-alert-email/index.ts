import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { checkRateLimit, getClientIdentifier } from "../_shared/rateLimit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmailRequest {
  userId: string;
  email: string;
  beatName: string;
  newMatches: Array<{
    song_title: string;
    artist: string;
    confidence_score: number;
    spotify_url?: string;
    apple_music_url?: string;
    youtube_url?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for email endpoint to prevent spam (5 emails per hour)
    const clientId = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(clientId, 'send-alert-email', {
      maxRequests: 5,
      windowMinutes: 60
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Too many emails sent.',
          resetAt: rateLimit.resetAt 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { email, beatName, newMatches }: AlertEmailRequest = await req.json();

    console.log(`Sending alert email to ${email} for beat: ${beatName}`);

    const matchesHtml = newMatches.map((match, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #111827;">${match.song_title}</strong><br/>
          <span style="color: #6b7280; font-size: 14px;">${match.artist}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="display: inline-block; padding: 4px 12px; background-color: ${
            match.confidence_score >= 85 ? '#10b981' : match.confidence_score >= 60 ? '#f59e0b' : '#ef4444'
          }; color: white; border-radius: 12px; font-weight: 600; font-size: 14px;">
            ${Math.round(match.confidence_score)}%
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${match.spotify_url ? `<a href="${match.spotify_url}" style="color: #1DB954; text-decoration: none; margin-right: 8px;">Spotify</a>` : ''}
          ${match.apple_music_url ? `<a href="${match.apple_music_url}" style="color: #FA243C; text-decoration: none; margin-right: 8px;">Apple Music</a>` : ''}
          ${match.youtube_url ? `<a href="${match.youtube_url}" style="color: #FF0000; text-decoration: none;">YouTube</a>` : ''}
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🎵 New Beat Matches Found!
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                PulseFind Auto-Alert System
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 20px;">
              <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hey there! 👋
              </p>
              <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We've detected <strong style="color: #667eea;">${newMatches.length} new song${newMatches.length !== 1 ? 's' : ''}</strong> using your beat <strong>"${beatName}"</strong> across streaming platforms.
              </p>

              <!-- Alert Box -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.5;">
                  <strong>💡 Pro Tip:</strong> High confidence matches (85%+) are perfect for DMCA takedown claims. You can generate a full evidence package in PulseFind.
                </p>
              </div>

              <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 32px 0 16px 0;">
                Detected Matches
              </h2>

              <!-- Matches Table -->
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Song</th>
                    <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Confidence</th>
                    <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  ${matchesHtml}
                </tbody>
              </table>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://pulsefind.lovable.app'}/history" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Full Details & Generate Evidence Package
                </a>
              </div>

              <!-- Info Box -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>⚖️ Take Action:</strong> If these are unauthorized uses, you can download a professional evidence package with DMCA templates to protect your work.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                This is an automated alert from your PulseFind Auto-Alert System. We continuously monitor the internet for usage of your beats.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                © 2024 PulseFind - Professional Beat Usage Detection Platform
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Created by Marvelous
              </p>
            </div>

          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "PulseFind Alerts <alerts@pulsefind.xyz>",
      to: [email],
      subject: `🎵 New Matches Found for "${beatName}"`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log("Alert email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending alert email:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to send alert email",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
