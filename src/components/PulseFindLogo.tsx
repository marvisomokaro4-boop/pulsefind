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
  const sizeMap = {
    sm: { width: 32, height: 32, text: "text-base" },
    md: { width: 40, height: 40, text: "text-xl" },
    lg: { width: 80, height: 80, text: "text-4xl" },
    xl: { width: 96, height: 96, text: "text-6xl" }
  };

  const sizes = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Unique P + Pulse Symbol Logo */}
      <div className="relative">
        {/* Outer pulse ring */}
        <div className={cn(
          "absolute -inset-2 rounded-2xl bg-primary/20 blur-sm",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} />
        
        {/* Middle pulse ring */}
        <div className={cn(
          "absolute -inset-1 rounded-2xl bg-primary/30 blur-sm",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} style={{ animationDelay: "0.15s" }} />
        
        {/* SVG Logo - P with integrated pulse waveform */}
        <div className={cn(
          "relative rounded-2xl bg-gradient-primary flex items-center justify-center p-2",
          "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} style={{ 
          animationDelay: "0.3s",
          width: sizes.width,
          height: sizes.height 
        }}>
          <svg 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Letter P outline */}
            <path
              d="M 25 20 L 25 80 M 25 20 L 55 20 Q 70 20 70 35 Q 70 50 55 50 L 25 50"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            />
            
            {/* Pulse waveform integrated through the P */}
            <path
              d="M 15 50 L 25 50 L 30 35 L 35 65 L 40 45 L 45 55 L 50 50 L 75 50 L 80 35 L 85 50"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground opacity-90"
              style={{
                filter: "drop-shadow(0 0 4px currentColor)"
              }}
            />
          </svg>
        </div>
      </div>

      {/* Brand text */}
      {showText && (
        <span className={cn(
          "font-bold bg-gradient-primary bg-clip-text text-transparent",
          sizes.text
        )}>
          PulseFind
        </span>
      )}
    </div>
  );
};
