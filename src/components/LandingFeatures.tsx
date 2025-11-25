import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Zap, Bell, BarChart3, Shield, Layers } from "lucide-react";

export const LandingFeatures = () => {
  const features = [
    {
      icon: Search,
      title: "Audio Fingerprinting",
      description: "Advanced technology like Shazam identifies your beats in millions of songs across streaming platforms."
    },
    {
      icon: Layers,
      title: "Multi-Platform Search",
      description: "Find your beats on Spotify, Apple Music, YouTube Music, and more - all in one search."
    },
    {
      icon: Zap,
      title: "Batch Analysis",
      description: "Upload multiple beats at once and compare results side-by-side for efficient workflow."
    },
    {
      icon: Bell,
      title: "Real-Time Notifications",
      description: "Get notified instantly when your beats are used in new songs (Elite tier)."
    },
    {
      icon: BarChart3,
      title: "Confidence Scores",
      description: "See match confidence levels and detailed analytics for every identified song."
    },
    {
      icon: Shield,
      title: "Copyright Detection",
      description: "Analyze potential sample and copyright concerns in identified matches (Pro tier)."
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Powerful Features for Producers</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Everything you need to track and manage your beat usage across the music industry
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="border-border hover:border-primary/50 transition-all hover:shadow-[0_0_20px_hsl(180_100%_50%/0.2)]">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
              <CardDescription className="text-base">
                {feature.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
};
