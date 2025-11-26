import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AnonymousScanBanner = () => {
  const navigate = useNavigate();

  return (
    <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-semibold mb-1">Like what you see?</h3>
          <p className="text-sm text-muted-foreground">
            Create a free account to save your scan history, track beat usage over time, and access unlimited scans with Pro.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button 
            onClick={() => navigate('/auth')}
            className="gap-2"
          >
            <Lock className="w-4 h-4" />
            Sign Up Free
          </Button>
        </div>
      </div>
    </Card>
  );
};
