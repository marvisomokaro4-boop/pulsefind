import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TestAlerts() {
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingScan, setIsTestingScan] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const testEmailAlert = async () => {
    setIsTestingEmail(true);
    setEmailResult(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        throw new Error("No user email found");
      }

      // Send a test email with sample match data
      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: {
          email: user.email,
          beatName: "Test Beat - Demo",
          newMatches: [
            {
              song_title: "Test Song 1",
              artist: "Test Artist",
              confidence_score: 92,
              spotify_url: "https://open.spotify.com/track/test",
              apple_music_url: "https://music.apple.com/test",
              youtube_url: "https://youtube.com/watch?v=test"
            },
            {
              song_title: "Test Song 2",
              artist: "Another Artist",
              confidence_score: 78,
              spotify_url: "https://open.spotify.com/track/test2",
            },
            {
              song_title: "Test Song 3",
              artist: "Third Artist",
              confidence_score: 54,
              youtube_url: "https://youtube.com/watch?v=test3"
            }
          ]
        }
      });

      if (error) throw error;

      setEmailResult("success");
      toast({
        title: "Test Email Sent! 📧",
        description: `Check your inbox at ${user.email}. The email may take 1-2 minutes to arrive.`,
      });
    } catch (error) {
      console.error("Email test error:", error);
      setEmailResult("error");
      toast({
        title: "Email Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const testAutoScan = async () => {
    setIsTestingScan(true);
    setScanResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('auto-alert-scan', {
        body: {}
      });

      if (error) throw error;

      setScanResult("success");
      toast({
        title: "Auto-Scan Triggered! 🔍",
        description: `Scanned ${data.beatsScanned} beats, found ${data.newMatchesFound} new matches, sent ${data.alertsSent} alerts`,
      });
    } catch (error) {
      console.error("Auto-scan test error:", error);
      setScanResult("error");
      toast({
        title: "Auto-Scan Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingScan(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            ← Back to Home
          </Button>
          <h1 className="text-4xl font-bold mb-2">Test Auto-Alert System</h1>
          <p className="text-muted-foreground">
            Test the email notifications and auto-scanning functionality
          </p>
        </div>

        <div className="grid gap-6">
          {/* Test Email Alert */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Test Email Alert</h3>
                <p className="text-muted-foreground mb-4">
                  Send a sample alert email to your account with test match data. This will show you exactly what producers receive when new matches are detected.
                </p>
                
                <Button
                  onClick={testEmailAlert}
                  disabled={isTestingEmail}
                  className="gap-2"
                >
                  {isTestingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Test Email...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Send Test Email
                    </>
                  )}
                </Button>

                {emailResult && (
                  <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
                    emailResult === "success" 
                      ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                  }`}>
                    {emailResult === "success" ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Email sent successfully!</p>
                          <p className="text-sm opacity-80">Check your inbox (may take 1-2 minutes)</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Failed to send email</p>
                          <p className="text-sm opacity-80">Check console for error details</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Test Auto-Scan */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Test Auto-Scan</h3>
                <p className="text-muted-foreground mb-4">
                  Manually trigger the auto-alert scan system. This will check all Pro users' beats for new matches and send email alerts if new matches are found.
                </p>
                
                <Button
                  onClick={testAutoScan}
                  disabled={isTestingScan}
                  className="gap-2"
                  variant="secondary"
                >
                  {isTestingScan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running Scan...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Manual Scan
                    </>
                  )}
                </Button>

                {scanResult && (
                  <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
                    scanResult === "success" 
                      ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                  }`}>
                    {scanResult === "success" ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Scan completed successfully!</p>
                          <p className="text-sm opacity-80">Check toast notification for details</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <div>
                          <p className="font-medium">Scan failed</p>
                          <p className="text-sm opacity-80">Check console for error details</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Instructions */}
          <Card className="p-6 bg-muted/50">
            <h3 className="text-lg font-semibold mb-3">📋 Testing Instructions</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click "Send Test Email" to receive a sample alert email</li>
              <li>Check your inbox for the email (it may take 1-2 minutes)</li>
              <li>Verify the email formatting, match details, and links</li>
              <li>Click "Run Manual Scan" to test the full auto-alert system</li>
              <li>The scan will check all Pro users' beats and send real alerts</li>
            </ol>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Make sure you've verified your sending domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">resend.com/domains</a> for emails to be delivered properly.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
