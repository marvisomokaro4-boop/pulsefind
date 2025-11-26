import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/pulsefind-logo.png";

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
    sm: { width: "32px", height: "32px", text: "text-base" },
    md: { width: "40px", height: "40px", text: "text-xl" },
    lg: { width: "80px", height: "80px", text: "text-4xl" },
    xl: { width: "96px", height: "96px", text: "text-6xl" }
  };

  const sizes = sizeMap[size];

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
          <img 
            src={logoImage} 
            alt="PulseFind Logo" 
            className="w-full h-full object-contain p-1"
          />
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
