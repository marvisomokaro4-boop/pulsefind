import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const LandingHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-primary opacity-10" />
      <div className="container mx-auto px-4 py-20 relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Launch Offer Badge */}
          <div className="flex justify-center mb-6">
            <Badge className="px-4 py-2 text-sm bg-primary/20 text-primary border-primary/30 animate-pulse">
              <Sparkles className="w-4 h-4 mr-2" />
              Launch Offer: First 50 Users Get Elite Free for 3 Months!
            </Badge>
          </div>

          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-card border border-primary/30 shadow-[0_0_30px_hsl(180_100%_50%/0.3)]">
              <Music2 className="w-16 h-16 text-primary" />
            </div>
          </div>

          <h1 className="text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            BeatMatch
          </h1>
          
          <p className="text-2xl text-foreground mb-4 font-semibold">
            Discover Who's Using Your Beats
          </p>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Upload your producer beat and find all the songs using it across Spotify, Apple Music, and more. 
            Like Shazam, but built specifically for producers to track their beats.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Get Started Free
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/pricing")}
              className="text-lg px-8"
            >
              View Pricing
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • 3 free scans daily
          </p>
        </div>
      </div>
      
      {/* Animated wave bars */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end gap-1 h-16 opacity-30 px-4">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-t"
            style={{
              animation: `wave 1s ease-in-out infinite`,
              animationDelay: `${i * 0.02}s`,
              height: `${Math.random() * 60 + 10}%`,
            }}
          />
        ))}
      </div>
    </section>
  );
};
