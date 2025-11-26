import { Progress } from "@/components/ui/progress";
import { Music, Radio, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface AnalysisProgressProps {
  fileName: string;
  fileSize: number;
}

const AnalysisProgress = ({ fileName, fileSize }: AnalysisProgressProps) => {
  const [currentSegment, setCurrentSegment] = useState(1);
  const [pulseScale, setPulseScale] = useState(1);
  
  // Calculate estimated segment count - simplified with 512KB segments and 50% overlap
  const estimatedSegments = Math.ceil(fileSize / (256 * 1024));
  
  // Animate through segments - adjusted to match actual processing time
  useEffect(() => {
    // Realistic timing: fingerprinting + ACRCloud + multi-platform search takes ~10-15s
    // Spread the animation across this timeframe for better UX
    const segmentDuration = 1200; // ms per segment animation (increased from 300ms)
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

  // Pulse animation effect
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseScale(prev => prev === 1 ? 1.05 : 1);
    }, 800);
    return () => clearInterval(pulseInterval);
  }, []);

  const progress = (currentSegment / estimatedSegments) * 100;

  return (
    <div className="py-10 px-4 space-y-8 animate-fade-in">
      {/* Animated Icon Section */}
      <div className="flex justify-center relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-primary/10 animate-pulse" />
        </div>
        
        {/* Middle ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-24 h-24 rounded-full border-2 border-primary/30 animate-spin"
            style={{ animationDuration: '3s' }}
          />
        </div>
        
        {/* Inner animated icons */}
        <div className="relative z-10 flex items-center justify-center w-20 h-20">
          <div 
            className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
            style={{ transform: `scale(${pulseScale})` }}
          >
            <Music className="w-10 h-10 text-primary" />
          </div>
          <Radio className="w-5 h-5 text-primary/60 absolute top-0 right-0 animate-pulse" />
          <Sparkles className="w-4 h-4 text-primary/60 absolute bottom-0 left-0 animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="space-y-2 text-center">
          <h3 className="font-bold text-xl bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            Analyzing Your Beat
          </h3>
          {fileName && (
            <p className="text-sm text-muted-foreground truncate px-4 animate-fade-in">
              {fileName}
            </p>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-3 bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Scanning Progress</span>
            <span className="font-mono font-bold text-primary tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          
          <div className="relative">
            <Progress value={progress} className="h-3 bg-muted/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[slide-in-right_1.5s_ease-in-out_infinite]" />
          </div>
          
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Segment {currentSegment}</span>
            <span>of {estimatedSegments}</span>
          </div>
        </div>

        {/* Segment Dots Visualization */}
        <div className="flex flex-wrap justify-center gap-1.5 py-3">
          {Array.from({ length: Math.min(estimatedSegments, 24) }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-500 ${
                i < currentSegment
                  ? 'bg-primary scale-100 shadow-[0_0_6px_hsl(var(--primary))]'
                  : 'bg-muted/40 scale-75'
              }`}
              style={{ 
                transitionDelay: `${i * 20}ms`,
              }}
            />
          ))}
          {estimatedSegments > 24 && (
            <span className="text-xs text-muted-foreground ml-2 self-center">
              +{estimatedSegments - 24}
            </span>
          )}
        </div>

        {/* Status Message */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Scanning audio fingerprint across multiple segments<br/>
            for maximum detection accuracy
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisProgress;