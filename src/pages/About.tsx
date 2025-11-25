import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Instagram, Youtube, Mail } from "lucide-react";

const About = () => {
  // Your social media links
  const socialLinks = {
    instagram: "https://www.instagram.com/marvbeats33",
    youtube: "https://www.youtube.com/@marvbeats33",
    email: "contact@beatfinder.com"
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="p-6 rounded-full bg-gradient-to-br from-primary to-secondary">
            <Music className="h-16 w-16 text-background" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          About BeatFinder
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The ultimate tool for producers to discover which songs use their beats across all major streaming platforms
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
            <CardDescription>Empowering music producers worldwide</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              BeatFinder was created to solve a critical problem that producers face: tracking where and how their beats are being used across the music industry. Using advanced audio fingerprinting technology similar to Shazam and YouTube Content ID, we help you discover every song that incorporates your beats.
            </p>
            <p className="text-foreground">
              Whether you're an established producer or just starting out, BeatFinder gives you the insights you need to understand your impact across Spotify, Apple Music, YouTube Music, and more.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Advanced Audio Fingerprinting</p>
                  <p className="text-sm text-muted-foreground">
                    Shazam-like technology to identify your beats in songs across all DSPs
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-secondary mt-2" />
                <div>
                  <p className="font-medium">Multi-Platform Coverage</p>
                  <p className="text-sm text-muted-foreground">
                    Track usage across Spotify, Apple Music, YouTube Music, and more
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-accent mt-2" />
                <div>
                  <p className="font-medium">Historical Tracking</p>
                  <p className="text-sm text-muted-foreground">
                    Maintain a complete portfolio of your beat usage over time
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Batch Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Upload multiple beats at once and compare results side-by-side
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect With Us</CardTitle>
            <CardDescription>Follow our journey and stay updated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px]"
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-[#E4405F]/10 hover:border-[#E4405F] hover:text-[#E4405F] transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                  Follow on Instagram
                </Button>
              </a>
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px]"
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-[#FF0000]/10 hover:border-[#FF0000] hover:text-[#FF0000] transition-colors"
                >
                  <Youtube className="h-5 w-5" />
                  Subscribe on YouTube
                </Button>
              </a>
              <a
                href={`mailto:${socialLinks.email}`}
                className="flex-1 min-w-[200px]"
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  Email Us
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardHeader>
            <CardTitle>Special Launch Offer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-4">
              <strong>First 50 signups get Elite tier FREE for 3 months!</strong> Get unlimited scans, beat usage notifications, and priority support.
            </p>
            <Button 
              onClick={() => window.location.href = '/auth'}
              className="w-full sm:w-auto"
            >
              Sign Up Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default About;
