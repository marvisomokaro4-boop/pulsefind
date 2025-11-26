import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const sizeMap = {
    sm: { width: "32px", height: "32px", text: "text-base" },
    md: { width: "40px", height: "40px", text: "text-xl" },
    lg: { width: "80px", height: "80px", text: "text-4xl" },
    xl: { width: "96px", height: "96px", text: "text-6xl" }
  };

  const sizes = sizeMap[size];

  // Check for selected logo on mount
  useEffect(() => {
    const selectedLogo = localStorage.getItem('pulsefind-logo-selected');
    if (selectedLogo) {
      setLogoUrl(selectedLogo);
    }
  }, []);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo container with pulse animations */}
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
        
        {/* Logo display */}
        <div 
          className={cn(
            "relative rounded-2xl bg-gradient-primary flex items-center justify-center",
            "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
            "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]",
            "overflow-hidden"
          )}
          style={{ 
            animationDelay: "0.3s",
            width: sizes.width,
            height: sizes.height 
          }}
        >
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="PulseFind Logo" 
              className="w-full h-full object-cover"
            />
          ) : (
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full p-2"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Letter P */}
              <path
                d="M 25 20 L 25 80 M 25 20 L 55 20 Q 70 20 70 35 Q 70 50 55 50 L 25 50"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground"
                fill="none"
              />
              {/* Pulse waveform */}
              <path
                d="M 15 50 L 25 50 L 30 35 L 35 65 L 40 45 L 45 55 L 50 50 L 75 50 L 80 35 L 85 50"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground opacity-90"
                fill="none"
                style={{
                  filter: "drop-shadow(0 0 4px currentColor)"
                }}
              />
            </svg>
          )}
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
