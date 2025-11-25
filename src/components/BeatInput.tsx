import { useState, useRef } from "react";
import { Upload, Loader2, Check, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Match {
  title: string;
  artist: string;
  album?: string;
  confidence?: number;
  source: string;
  spotify_id?: string;
  spotify_url?: string;
  apple_music_id?: string;
  apple_music_url?: string;
  share_url?: string;
}

interface BeatInputProps {
  onMatchesFound: (matches: Match[]) => void;
}

const BeatInput = ({ onMatchesFound }: BeatInputProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [isComplete, setIsComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an audio file (MP3, WAV, OGG, M4A).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit - ACRCloud recommends 10-20 seconds of audio)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please upload a shorter audio clip (10-20 seconds recommended). Maximum file size is 5MB.",
        variant: "destructive",
      });
      return;
    }

    setFileName(file.name);
    setIsAnalyzing(true);
    setIsComplete(false);

    try {
      // Create FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', file);

      // Call the identify-beat edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-beat`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to identify beat');
      }

      const data = await response.json();

      if (data.success && data.matches && data.matches.length > 0) {
        onMatchesFound(data.matches);
        setIsComplete(true);
        
        toast({
          title: "Matches Found!",
          description: `Found ${data.matches.length} song(s) using your beat`,
        });
      } else {
        toast({
          title: "No Matches Found",
          description: "We couldn't find any songs using this beat. The beat might not be in any released tracks yet.",
        });
      }
    } catch (error) {
      console.error('Error identifying beat:', error);
      toast({
        title: "Identification Failed",
        description: "Unable to identify songs using this beat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
    setIsComplete(false);
  };

  return (
    <Card className="max-w-2xl mx-auto p-8 bg-card/50 backdrop-blur border-primary/20">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Music className="w-12 h-12 text-primary" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-2">Upload Your Beat</h2>
          <p className="text-muted-foreground">
            Upload your producer beat to find which songs are using it
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Recommended: 10-20 seconds of audio • Max 5MB
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!isAnalyzing && !isComplete && (
          <Button
            onClick={handleUploadClick}
            size="lg"
            className="w-full max-w-sm group"
          >
            <Upload className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Choose Audio File
          </Button>
        )}

        {isAnalyzing && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <div className="space-y-2">
              <p className="font-medium">Identifying your beat...</p>
              {fileName && (
                <p className="text-sm text-muted-foreground">{fileName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Searching across multiple platforms...
              </p>
            </div>
          </div>
        )}

        {isComplete && !isAnalyzing && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Check className="w-8 h-8 text-primary" />
              <p className="text-xl font-bold">Search Complete</p>
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground">{fileName}</p>
            )}
            <Button
              onClick={handleUploadClick}
              variant="outline"
              className="mt-4"
            >
              Search Another Beat
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BeatInput;
