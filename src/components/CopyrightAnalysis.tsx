import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Match {
  title: string;
  artist: string;
  album?: string;
}

interface CopyrightAnalysisProps {
  matches: Match[];
  beatName: string;
}

interface CopyrightResult {
  hasCopyright: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  analysis: string;
  recommendations: string[];
}

const CopyrightAnalysis = ({ matches, beatName }: CopyrightAnalysisProps) => {
  const [result, setResult] = useState<CopyrightResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { toast } = useToast();

  const analyzeContent = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-copyright', {
        body: { matches, beatName }
      });

      if (error) throw error;

      if (data) {
        setResult(data);
        setHasAnalyzed(true);
      }
    } catch (error: any) {
      console.error('Error analyzing copyright:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Unable to analyze copyright. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high': return AlertTriangle;
      case 'medium': return Shield;
      case 'low': return CheckCircle;
      default: return Shield;
    }
  };

  if (!hasAnalyzed) {
    return (
      <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-blue-500/10">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Copyright Detection</h3>
            <p className="text-muted-foreground mb-4">
              Analyze potential copyright issues and sample usage in your beat
            </p>
          </div>
          <Button onClick={analyzeContent} disabled={isLoading} className="w-full max-w-xs">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Check Copyright
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  if (!result) return null;

  const RiskIcon = getRiskIcon(result.riskLevel);

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <RiskIcon className={`w-5 h-5 ${getRiskColor(result.riskLevel)}`} />
          <h3 className="text-xl font-bold">Copyright Analysis</h3>
          <Badge 
            variant={result.hasCopyright ? 'destructive' : 'secondary'}
            className="ml-auto"
          >
            {result.riskLevel.toUpperCase()} RISK
          </Badge>
        </div>

        <div className="p-4 bg-background/50 rounded-lg">
          <p className="text-sm">{result.analysis}</p>
        </div>

        {result.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Recommendations:</h4>
            <ul className="space-y-2">
              {result.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button 
          variant="outline" 
          onClick={analyzeContent} 
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

export default CopyrightAnalysis;