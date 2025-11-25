import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Music, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeBPM } from "@/lib/bpmDetector";

interface BeatInputProps {
  onBpmDetected: (bpm: number) => void;
}

const BeatInput = ({ onBpmDetected }: BeatInputProps) => {
  const [bpm, setBpm] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (MP3, WAV, etc.)",
        variant: "destructive",
      });
      return;
    }

    setFileName(file.name);
    setIsAnalyzing(true);

    try {
      const detectedBpm = await analyzeBPM(file);
      setBpm(detectedBpm);
      onBpmDetected(detectedBpm);
      
      toast({
        title: "Beat Analyzed!",
        description: `Detected ${detectedBpm} BPM`,
      });
    } catch (error) {
      console.error('BPM detection error:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the audio file. Try another file.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 bg-card border-primary/20 shadow-lg">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Music className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Upload Your Beat</h2>
          </div>
          
          <p className="text-muted-foreground">
            Upload an audio file to detect its BPM and find matching songs
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="relative">
            <Button
              onClick={handleUploadClick}
              disabled={isAnalyzing}
              size="lg"
              className="w-48 h-48 rounded-full text-xl font-bold bg-gradient-primary hover:opacity-90 transition-all duration-200"
            >
              {isAnalyzing ? (
                <Loader2 className="w-12 h-12 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-12 h-12" />
                  <span>Upload</span>
                </div>
              )}
            </Button>
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              {fileName}
            </p>
          )}

          {bpm && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-6 bg-muted/50 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Detected BPM</p>
                <p className="text-5xl font-bold text-primary">{bpm}</p>
              </div>
              
              <Button
                onClick={handleUploadClick}
                variant="outline"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Another Beat
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BeatInput;
