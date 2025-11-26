import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Shield, Zap } from "lucide-react";

interface MatchingModeToggleProps {
  mode: 'strict' | 'loose';
  onModeChange: (mode: 'strict' | 'loose') => void;
}

export const MatchingModeToggle = ({ mode, onModeChange }: MatchingModeToggleProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Matching Mode:</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant={mode === 'strict' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('strict')}
          className="gap-2"
        >
          <Shield className="w-4 h-4" />
          Strict
          <Badge variant="secondary" className="ml-1">85%+</Badge>
        </Button>
        <Button
          variant={mode === 'loose' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('loose')}
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          Loose
          <Badge variant="secondary" className="ml-1">40%+</Badge>
        </Button>
      </div>
      <div className="text-xs text-muted-foreground text-center sm:text-left max-w-md">
        {mode === 'strict' ? (
          <>Exact duplicates only - ideal for copyright claims</>
        ) : (
          <>Includes remixes, pitched & chopped versions - ideal for discovery</>
        )}
      </div>
    </div>
  );
};
