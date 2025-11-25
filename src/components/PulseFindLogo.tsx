import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface PulseFindLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export const PulseFindLogo = ({ 
  size = "md", 
  showText = true,
  className 
}: PulseFindLogoProps) => {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  };

  const textSizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-4xl",
    xl: "text-6xl"
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Animated pulse icon */}
      <div className="relative">
        {/* Outer pulse ring */}
        <div className={cn(
          "absolute inset-0 rounded-full bg-primary/20",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} />
        
        {/* Middle pulse ring */}
        <div className={cn(
          "absolute inset-0 rounded-full bg-primary/30",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]",
          "animation-delay-150"
        )} style={{ animationDelay: "0.15s" }} />
        
        {/* Icon container */}
        <div className={cn(
          "relative rounded-full bg-gradient-primary p-2",
          "shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
        )}>
          <Activity className={cn(sizeClasses[size], "text-primary-foreground")} />
        </div>
      </div>

      {/* Brand text */}
      {showText && (
        <span className={cn(
          "font-bold bg-gradient-primary bg-clip-text text-transparent",
          textSizeClasses[size]
        )}>
          PulseFind
        </span>
      )}
    </div>
  );
};
