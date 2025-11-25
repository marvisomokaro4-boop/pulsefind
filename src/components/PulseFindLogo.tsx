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
    sm: { container: "h-8 w-8", text: "text-base", fontSize: "text-lg" },
    md: { container: "h-10 w-10", text: "text-xl", fontSize: "text-2xl" },
    lg: { container: "h-20 w-20", text: "text-4xl", fontSize: "text-5xl" },
    xl: { container: "h-24 w-24", text: "text-6xl", fontSize: "text-7xl" }
  };

  const sizes = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Animated pulse logo with P */}
      <div className="relative">
        {/* Outer pulse ring */}
        <div className={cn(
          "absolute inset-0 rounded-xl bg-primary/20",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} />
        
        {/* Middle pulse ring */}
        <div className={cn(
          "absolute inset-0 rounded-xl bg-primary/30",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        )} style={{ animationDelay: "0.15s" }} />
        
        {/* Logo container with stylized P */}
        <div className={cn(
          "relative rounded-xl bg-gradient-primary flex items-center justify-center",
          "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
          "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]",
          sizes.container
        )} style={{ animationDelay: "0.3s" }}>
          <span className={cn(
            "font-black text-primary-foreground drop-shadow-lg",
            sizes.fontSize
          )}>
            P
          </span>
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
