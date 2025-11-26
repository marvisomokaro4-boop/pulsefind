import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/pulsefind-logo.png";
import { removeBackground, loadImageFromUrl } from "@/lib/removeBackground";

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
  const [processedLogo, setProcessedLogo] = useState<string>(logoImage);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processLogo = async () => {
      // Check if we already have a processed version in localStorage
      const cached = localStorage.getItem('pulsefind-logo-processed');
      if (cached) {
        setProcessedLogo(cached);
        return;
      }

      setIsProcessing(true);
      try {
        const img = await loadImageFromUrl(logoImage);
        const blob = await removeBackground(img);
        const url = URL.createObjectURL(blob);
        setProcessedLogo(url);
        
        // Cache the processed logo
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem('pulsefind-logo-processed', reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Failed to process logo:', error);
        // Fallback to original logo
        setProcessedLogo(logoImage);
      } finally {
        setIsProcessing(false);
      }
    };

    processLogo();
  }, []);

  const sizeMap = {
    sm: { width: "32px", height: "32px", text: "text-base" },
    md: { width: "40px", height: "40px", text: "text-xl" },
    lg: { width: "80px", height: "80px", text: "text-4xl" },
    xl: { width: "96px", height: "96px", text: "text-6xl" }
  };

  const sizes = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo container */}
      <div className="relative">
        {/* Logo display */}
        <div 
          className={cn(
            "relative rounded-full bg-gradient-primary flex items-center justify-center",
            "overflow-hidden"
          )}
          style={{ 
            width: sizes.width,
            height: sizes.height 
          }}
        >
          {isProcessing ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            </div>
          ) : (
            <img 
              src={processedLogo} 
              alt="PulseFind Logo" 
              className="w-full h-full object-contain p-1"
            />
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
