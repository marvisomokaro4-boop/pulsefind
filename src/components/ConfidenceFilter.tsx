import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ConfidenceFilterProps {
  showLowConfidence: boolean;
  onToggle: (value: boolean) => void;
  lowConfidenceCount: number;
}

const ConfidenceFilter = ({ showLowConfidence, onToggle, lowConfidenceCount }: ConfidenceFilterProps) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
      <div className="space-y-0.5">
        <Label htmlFor="confidence-filter" className="text-sm font-medium cursor-pointer">
          Show low-confidence matches (below 70%)
        </Label>
        <p className="text-xs text-muted-foreground">
          {lowConfidenceCount > 0 
            ? `${lowConfidenceCount} additional match${lowConfidenceCount > 1 ? 'es' : ''} available`
            : 'No low-confidence matches found'
          }
        </p>
      </div>
      <Switch
        id="confidence-filter"
        checked={showLowConfidence}
        onCheckedChange={onToggle}
      />
    </div>
  );
};

export default ConfidenceFilter;
