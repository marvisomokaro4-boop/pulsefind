import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);

  const sizeMap = {
    sm: { width: "32px", height: "32px", text: "text-base" },
    md: { width: "40px", height: "40px", text: "text-xl" },
    lg: { width: "80px", height: "80px", text: "text-4xl" },
    xl: { width: "96px", height: "96px", text: "text-6xl" }
  };

  const sizes = sizeMap[size];

  useEffect(() => {
    const generateLogo = async () => {
      try {
        // Check localStorage first
        const cachedLogo = localStorage.getItem('pulsefind-logo');
        if (cachedLogo) {
          setLogoUrl(cachedLogo);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('generate-logo', {
          body: {
            prompt: `Create a modern, sleek logo for "PulseFind" - a music production platform. The logo should combine a stylized letter "P" with a pulse waveform/heartbeat line, inspired by music industry brands like Beatstars, Spotify, and SoundCloud. Use a vibrant cyan/teal gradient (#00D4FF to #7B61FF). The design should be minimalist, iconic, professional, and work well at small sizes. Make it square-shaped with a rounded background, perfect for an app icon. The pulse line should elegantly integrate through or around the letter P. Ultra high resolution, clean lines, no text.`
          }
        });

        if (error) throw error;

        if (data?.imageUrl) {
          setLogoUrl(data.imageUrl);
          // Cache the logo
          localStorage.setItem('pulsefind-logo', data.imageUrl);
        }
      } catch (error) {
        console.error('Error generating logo:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateLogo();
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
          {isLoading ? (
            <Activity className={cn("animate-pulse text-primary-foreground", size === "sm" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : size === "lg" ? "h-12 w-12" : "h-16 w-16")} />
          ) : logoUrl ? (
            <img 
              src={logoUrl} 
              alt="PulseFind Logo" 
              className="w-full h-full object-cover"
            />
          ) : (
            <Activity className={cn("text-primary-foreground", size === "sm" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : size === "lg" ? "h-12 w-12" : "h-16 w-16")} />
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
