import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ConfidenceSliderProps {
  minConfidence: number;
  onMinConfidenceChange: (value: number) => void;
  totalMatches: number;
  filteredCount: number;
}

const ConfidenceSlider = ({ 
  minConfidence, 
  onMinConfidenceChange, 
  totalMatches,
  filteredCount 
}: ConfidenceSliderProps) => {
  return (
    <Card className="p-4 bg-card/50 backdrop-blur border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Minimum Confidence: {minConfidence}%
          </Label>
          <span className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalMatches} matches
          </span>
        </div>
        
        <Slider
          value={[minConfidence]}
          onValueChange={(values) => onMinConfidenceChange(values[0])}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0% (Show All)</span>
          <span>50% (Default)</span>
          <span>100% (Perfect Only)</span>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Lower the threshold to see more potential matches. Higher confidence means stronger match certainty.
        </p>
      </div>
    </Card>
  );
};

export default ConfidenceSlider;
