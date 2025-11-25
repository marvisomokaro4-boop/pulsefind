import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Match {
  title: string;
  artist: string;
  album?: string;
}

interface SimilarSongsProps {
  matches: Match[];
}

interface SimilarSong {
  title: string;
  artist: string;
  reason: string;
}

const SimilarSongs = ({ matches }: SimilarSongsProps) => {
  const [similar, setSimilar] = useState<SimilarSong[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { toast } = useToast();

  const analyzeSimilarity = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-song-similarity', {
        body: { matches }
      });

      if (error) throw error;

      if (data?.similar) {
        setSimilar(data.similar);
        setAnalysis(data.analysis || '');
        setHasAnalyzed(true);
      }
    } catch (error: any) {
      console.error('Error analyzing similarity:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Unable to analyze similar songs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasAnalyzed) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Similar Song Matching</h3>
            <p className="text-muted-foreground mb-4">
              Get AI-powered recommendations for songs with similar vibes and genres
            </p>
          </div>
          <Button onClick={analyzeSimilarity} disabled={isLoading} className="w-full max-w-xs">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Find Similar Songs
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold">Similar Songs</h3>
          <Badge variant="secondary">AI Powered</Badge>
        </div>

        {analysis && (
          <p className="text-sm text-muted-foreground mb-4 p-3 bg-background/50 rounded-lg">
            {analysis}
          </p>
        )}

        <div className="space-y-3">
          {similar.map((song, index) => (
            <div
              key={index}
              className="p-4 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold">{song.title}</h4>
                  <p className="text-sm text-muted-foreground">{song.artist}</p>
                  <p className="text-xs text-muted-foreground mt-2 italic">{song.reason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button 
          variant="outline" 
          onClick={analyzeSimilarity} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Refresh Analysis'
          )}
        </Button>
      </div>
    </Card>
  );
};

export default SimilarSongs;