import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const LandingCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-4 py-16">
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="relative p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 rounded-full bg-primary/20">
              <Crown className="w-12 h-12 text-primary" />
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">
            Ready to Track Your Beats?
          </h2>
          
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join the first 50 users and get Pro tier access completely free for 3 months!
          </p>

          <div className="flex gap-4 justify-center mb-6 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Unlimited Scans</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Real-Time Notifications</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Batch Uploads</span>
            </div>
          </div>

          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="text-lg px-8"
          >
            Start Free Trial Now
          </Button>
          
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Limited time offer
          </p>
        </div>
      </Card>
    </section>
  );
};
