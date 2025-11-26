import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, Download } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [downloadingLogo, setDownloadingLogo] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setNewPassword("");
    }
    setLoading(false);
  };

  const downloadCurrentLogo = async () => {
    setDownloadingLogo(true);
    try {
      // Get current user's logo
      const { data: { user } } = await supabase.auth.getUser();
      let logoUrl = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('logo_url')
          .eq('id', user.id)
          .single();
        
        logoUrl = profile?.logo_url;
      }
      
      // Fallback to localStorage
      if (!logoUrl) {
        logoUrl = localStorage.getItem('pulsefind-logo-selected');
      }
      
      if (logoUrl) {
        // Download the image
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pulsefind-logo.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Logo downloaded!",
          description: "Your logo has been saved to your device.",
        });
      } else {
        // Download default SVG logo
        const svg = `<svg width="512" height="512" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#00D4FF;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#7B61FF;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="20" fill="url(#gradient)"/>
          <path d="M 25 20 L 25 80 M 25 20 L 55 20 Q 70 20 70 35 Q 70 50 55 50 L 25 50" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M 15 50 L 25 50 L 30 35 L 35 65 L 40 45 L 45 55 L 50 50 L 75 50 L 80 35 L 85 50" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" style="filter: drop-shadow(0 0 4px white)"/>
        </svg>`;
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pulsefind-logo.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Logo downloaded!",
          description: "Default logo has been saved to your device.",
        });
      }
    } catch (error) {
      console.error('Error downloading logo:', error);
      toast({
        title: "Error",
        description: "Failed to download logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingLogo(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Please sign in to access settings</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled className="bg-muted" />
            </div>
            <div>
              <Label>User ID</Label>
              <Input value={user.id} disabled className="bg-muted font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button onClick={handlePasswordChange} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Settings;
