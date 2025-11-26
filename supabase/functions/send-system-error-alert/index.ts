import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorSummary {
  timestamp: string;
  errorCount: number;
  criticalErrors: number;
  recentErrors: Array<{
    function: string;
    message: string;
    count: number;
    lastOccurred: string;
  }>;
  failedScans: number;
  lowSuccessRate: boolean;
}

interface EmailRequest {
  to: string;
  errorSummary: ErrorSummary;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, errorSummary }: EmailRequest = await req.json();

    console.log(`[SYSTEM-ERROR-ALERT] Sending alert to ${to}`);

    const errorList = errorSummary.recentErrors
      .map(error => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${error.function}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${error.message}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${error.count}</td>
        </tr>
      `)
      .join('');

    const statusColor = errorSummary.criticalErrors > 0 ? '#ef4444' : '#f59e0b';
    const statusText = errorSummary.criticalErrors > 0 ? 'CRITICAL' : 'WARNING';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🚨 PulseFind System Alert</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="background: ${statusColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin: 0;">${statusText}: System Errors Detected</h2>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="color: #667eea; margin-top: 0;">Error Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Scan Time:</td>
                <td style="padding: 8px;">${new Date(errorSummary.timestamp).toLocaleString()}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Total Errors:</td>
                <td style="padding: 8px;">${errorSummary.errorCount}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Critical Errors:</td>
                <td style="padding: 8px; color: ${errorSummary.criticalErrors > 0 ? '#ef4444' : '#10b981'};">
                  ${errorSummary.criticalErrors}
                </td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Failed Scans:</td>
                <td style="padding: 8px;">${errorSummary.failedScans}</td>
              </tr>
              ${errorSummary.lowSuccessRate ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">Status:</td>
                <td style="padding: 8px; color: #ef4444; font-weight: bold;">⚠️ Low Success Rate</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${errorSummary.recentErrors.length > 0 ? `
          <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="color: #667eea; margin-top: 0;">Recent Errors (Last 30 min)</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #667eea; color: white;">
                  <th style="padding: 10px; text-align: left;">Function</th>
                  <th style="padding: 10px; text-align: left;">Error Message</th>
                  <th style="padding: 10px; text-align: center;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${errorList}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div style="background: #eff6ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Action Required:</strong> Review the error logs and identify the root cause of these issues.
              Check edge function logs and database analytics for more details.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This is an automated system alert from PulseFind
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PulseFind Alerts <alerts@pulsefind.xyz>",
      to: [to],
      subject: `🚨 ${statusText}: PulseFind System Errors Detected - ${new Date(errorSummary.timestamp).toLocaleString()}`,
      html: emailHtml,
    });

    console.log("[SYSTEM-ERROR-ALERT] Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("[SYSTEM-ERROR-ALERT] Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
