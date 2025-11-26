import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Music, Search, History, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();

  const steps = [
    {
      title: "Welcome to PulseFind! 🎵",
      description: "Discover which songs are using your beats across all major streaming platforms.",
      icon: Music,
    },
    {
      title: "Upload Your Beat",
      description: "Simply upload your producer beat and our AI-powered fingerprinting technology will search for matches across Spotify, Apple Music, and YouTube Music.",
      icon: Search,
    },
    {
      title: "Track Your History",
      description: "View all your past beat scans and matches in one place. Keep track of which songs are using your production work.",
      icon: History,
    },
    {
      title: "Stay Notified",
      description: "Get alerts when new matches are found for your beats. Never miss when someone uses your production.",
      icon: Bell,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ has_seen_onboarding: true })
          .eq("id", user.id);

        if (error) throw error;
      }

      onClose();
      
      toast({
        title: "Let's get started!",
        description: "Upload your first beat to discover where it's being used.",
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      onClose();
    } finally {
      setIsCompleting(false);
    }
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <CurrentIcon className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            {steps[currentStep].title}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {steps[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 py-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isCompleting}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleNext}
            disabled={isCompleting}
            className="flex-1"
          >
            {currentStep === steps.length - 1 ? "Get Started" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
