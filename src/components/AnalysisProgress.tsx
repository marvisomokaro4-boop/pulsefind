import { Progress } from "@/components/ui/progress";
import { Activity, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AnalysisProgressProps {
  fileName: string;
  fileSize: number;
}

const AnalysisProgress = ({ fileName, fileSize }: AnalysisProgressProps) => {
  const [currentSegment, setCurrentSegment] = useState(1);
  
  // Calculate estimated segment count based on file size
  // 500KB per segment with 250KB overlap = ~250KB effective per segment
  const estimatedSegments = Math.ceil(fileSize / (250 * 1024));
  
  // Animate through segments
  useEffect(() => {
    const segmentDuration = 400; // ms per segment animation
    const interval = setInterval(() => {
      setCurrentSegment(prev => {
        if (prev >= estimatedSegments) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, segmentDuration);

    return () => clearInterval(interval);
  }, [estimatedSegments]);

  const progress = (currentSegment / estimatedSegments) * 100;

  return (
    <div className="py-8 space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-primary" />
          <Activity className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-semibold text-lg">Analyzing Beat Segments</p>
          {fileName && (
            <p className="text-sm text-muted-foreground truncate max-w-md mx-auto">
              {fileName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono font-semibold text-primary">
              Segment {currentSegment} / {estimatedSegments}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {Array.from({ length: Math.min(estimatedSegments, 20) }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full transition-all duration-300 ${
                i < currentSegment
                  ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]'
                  : 'bg-muted'
              }`}
            />
          ))}
          {estimatedSegments > 20 && (
            <span className="text-xs text-muted-foreground">
              +{estimatedSegments - 20} more
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Scanning through entire beat with overlapping segments for maximum accuracy
        </p>
      </div>
    </div>
  );
};

export default AnalysisProgress;