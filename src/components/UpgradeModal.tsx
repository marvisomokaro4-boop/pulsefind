import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpgradeModal = ({ open, onOpenChange }: UpgradeModalProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Crown className="w-6 h-6 text-primary" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            You've reached your monthly upload limit on the Free plan
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-foreground">Upgrade to Pro and get:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Unlimited uploads & scans</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Full deep scan analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Auto alerts when matches found</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Downloadable match reports</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Full scan history & metadata</span>
              </li>
            </ul>
          </div>

          <div className="text-center py-2">
            <p className="text-2xl font-bold text-primary">£4.99/month</p>
            <p className="text-sm text-muted-foreground">Cancel anytime</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="flex-1">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
