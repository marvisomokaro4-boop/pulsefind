import { useState, useRef } from "react";
import { Upload, Check, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AnalysisProgress from "./AnalysisProgress";

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
  youtube_id?: string;
  youtube_url?: string;
  share_url?: string;
  album_cover_url?: string;
  preview_url?: string;
}

interface BeatResult {
  fileName: string;
  matches: Match[];
  success: boolean;
}

interface BeatInputProps {
  onMatchesFound: (matches: Match[]) => void;
  onBatchResults?: (results: BeatResult[]) => void;
}

const BeatInput = ({ onMatchesFound, onBatchResults }: BeatInputProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [isComplete, setIsComplete] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [beatYear, setBeatYear] = useState<string>("");
  const [searchAllTime, setSearchAllTime] = useState(false);
  const [currentFileSize, setCurrentFileSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = async (file: File): Promise<BeatResult> => {

    try {
      // Create FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', file);
      
      // Add year filter if specified
      if (!searchAllTime && beatYear) {
        formData.append('beatYear', beatYear);
      }

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

      // Save to database
      if (data.success) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Insert beat record
          const { data: beatData, error: beatError } = await supabase
            .from("beats")
            .insert({
              user_id: user.id,
              file_name: file.name,
              file_size: file.size,
            })
            .select()
            .single();

          if (beatError) {
            console.error("Error saving beat:", beatError);
          } else if (beatData && data.matches && data.matches.length > 0) {
            // Insert matches
            const matches = data.matches.map((match: any) => ({
              beat_id: beatData.id,
              song_title: match.title,
              artist: match.artist,
              album: match.album,
              confidence: match.confidence,
              source: match.source,
              spotify_id: match.spotify_id,
              spotify_url: match.spotify_url,
              apple_music_id: match.apple_music_id,
              apple_music_url: match.apple_music_url,
              youtube_id: match.youtube_id,
              youtube_url: match.youtube_url,
              share_url: match.share_url,
              release_date: match.release_date,
              album_cover_url: match.album_cover_url,
              preview_url: match.preview_url,
            }));

            const { error: matchesError } = await supabase
              .from("beat_matches")
              .insert(matches);

            if (matchesError) {
              console.error("Error saving matches:", matchesError);
            }
          }
        }
      }

      return {
        fileName: file.name,
        matches: data.success ? data.matches : [],
        success: data.success,
      };
    } catch (error) {
      console.error('Error identifying beat:', error);
      return {
        fileName: file.name,
        matches: [],
        success: false,
      };
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    // Validate file types
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a'];
    const invalidFiles = filesArray.filter(
      file => !validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)
    );

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid File Type",
        description: `${invalidFiles.length} file(s) skipped. Please upload audio files only (MP3, WAV, OGG, M4A).`,
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes
    const maxSize = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = filesArray.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: `${oversizedFiles.length} file(s) exceed 50MB limit. Please compress your audio files.`,
        variant: "destructive",
      });
      return;
    }

    const isBatch = filesArray.length > 1;
    setIsBatchMode(isBatch);
    setTotalFiles(filesArray.length);
    setProcessedCount(0);
    setFileName(isBatch ? `${filesArray.length} files` : filesArray[0].name);
    setCurrentFileSize(filesArray[0].size);
    setIsAnalyzing(true);
    setIsComplete(false);

    try {
      // Process all files in parallel
      const results: BeatResult[] = [];
      
      for (let i = 0; i < filesArray.length; i++) {
        setCurrentFileSize(filesArray[i].size);
        const result = await processFile(filesArray[i]);
        results.push(result);
        setProcessedCount(i + 1);
      }

      const successfulResults = results.filter(r => r.success && r.matches.length > 0);
      
      if (isBatch && onBatchResults) {
        onBatchResults(results);
        
        if (successfulResults.length > 0) {
          toast({
            title: "Batch Analysis Complete!",
            description: `Found matches in ${successfulResults.length} of ${filesArray.length} beats`,
          });
        } else {
          toast({
            title: "No Matches Found",
            description: "We couldn't find any songs using these beats.",
          });
        }
      } else if (results.length === 1) {
        if (results[0].success && results[0].matches.length > 0) {
          onMatchesFound(results[0].matches);
          toast({
            title: "Matches Found!",
            description: `Found ${results[0].matches.length} song(s) using your beat`,
          });
        } else {
          toast({
            title: "No Matches Found",
            description: "We couldn't find any songs using this beat.",
          });
        }
      }

      setIsComplete(true);
    } catch (error) {
      console.error('Error in batch processing:', error);
      toast({
        title: "Processing Failed",
        description: "Unable to process files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUploadClick = () => {
    // Validate year if not searching all time
    if (!searchAllTime && beatYear) {
      const year = parseInt(beatYear);
      const currentYear = new Date().getFullYear();
      
      if (isNaN(year) || year < 1900 || year > currentYear) {
        toast({
          title: "Invalid Year",
          description: `Please enter a valid year between 1900 and ${currentYear}.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    fileInputRef.current?.click();
    setIsComplete(false);
    setIsBatchMode(false);
    setProcessedCount(0);
    setTotalFiles(0);
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
            Upload your full producer beat to find which songs are using it
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            We'll automatically analyze your beat • Max 50MB
          </p>
        </div>

        {/* Year Filter Section */}
        <div className="space-y-4 max-w-md mx-auto">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/50">
            <Label htmlFor="searchAllTime" className="text-sm font-medium cursor-pointer flex-1">
              Search all time (no year filter)
            </Label>
            <Switch
              id="searchAllTime"
              checked={searchAllTime}
              onCheckedChange={setSearchAllTime}
            />
          </div>

          {!searchAllTime && (
            <div className="space-y-2">
              <Label htmlFor="beatYear" className="text-sm font-medium">
                Year beat was made (optional)
              </Label>
              <input
                id="beatYear"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={beatYear}
                onChange={(e) => setBeatYear(e.target.value)}
                placeholder={`e.g., ${new Date().getFullYear()}`}
                className="w-full px-4 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground">
                We'll only show songs released after this year
              </p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {!isAnalyzing && !isComplete && (
          <div className="space-y-2">
            <Button
              onClick={handleUploadClick}
              size="lg"
              className="w-full max-w-sm group"
            >
              <Upload className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Choose Audio File(s)
            </Button>
            <p className="text-xs text-muted-foreground">
              Select multiple files for batch analysis
            </p>
          </div>
        )}

        {isAnalyzing && (
          <>
            {isBatchMode && (
              <div className="py-4 space-y-2 border-b border-border mb-4">
                <p className="text-sm font-medium text-primary">
                  Processing file {processedCount + 1} of {totalFiles}
                </p>
                <Progress value={(processedCount / totalFiles) * 100} className="h-2" />
              </div>
            )}
            <AnalysisProgress 
              fileName={fileName}
              fileSize={currentFileSize}
            />
          </>
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
