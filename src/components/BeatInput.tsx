import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, RotateCcw } from "lucide-react";

interface BeatInputProps {
  onBpmDetected: (bpm: number) => void;
}

const BeatInput = ({ onBpmDetected }: BeatInputProps) => {
  const [taps, setTaps] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const calculateBpm = (tapTimes: number[]) => {
    if (tapTimes.length < 2) return null;
    
    const intervals: number[] = [];
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const beatsPerMinute = Math.round(60000 / avgInterval);
    
    return beatsPerMinute;
  };

  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...taps, now];
    
    setTaps(newTaps);
    setIsActive(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
    }, 2000);

    if (newTaps.length >= 4) {
      const detectedBpm = calculateBpm(newTaps);
      if (detectedBpm) {
        setBpm(detectedBpm);
        onBpmDetected(detectedBpm);
      }
    }
  };

  const handleReset = () => {
    setTaps([]);
    setBpm(null);
    setIsActive(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 bg-card border-primary/20 shadow-lg">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Tap Your Beat</h2>
          </div>
          
          <p className="text-muted-foreground">
            Tap the button at least 4 times to the rhythm of your beat
          </p>

          <div className="relative">
            <Button
              onClick={handleTap}
              size="lg"
              className={`
                w-48 h-48 rounded-full text-xl font-bold
                bg-gradient-primary hover:opacity-90
                transition-all duration-200
                ${isActive ? 'scale-95 animate-pulse-glow' : 'scale-100'}
              `}
            >
              TAP
            </Button>
          </div>

          {bpm && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-6 bg-muted/50 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Detected BPM</p>
                <p className="text-5xl font-bold text-primary">{bpm}</p>
              </div>
              
              <Button
                onClick={handleReset}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          )}

          {taps.length > 0 && taps.length < 4 && (
            <p className="text-sm text-muted-foreground">
              {4 - taps.length} more tap{4 - taps.length !== 1 ? 's' : ''} needed
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BeatInput;
