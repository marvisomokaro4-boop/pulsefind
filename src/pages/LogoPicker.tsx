import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";

export default function LogoPicker() {
  const [logos, setLogos] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateLogos = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-logo-options');
      
      if (error) throw error;
      
      if (data?.logos) {
        setLogos(data.logos);
        toast({
          title: "Logos generated!",
          description: "Select your favorite design below.",
        });
      }
    } catch (error) {
      console.error('Error generating logos:', error);
      toast({
        title: "Error",
        description: "Failed to generate logo options. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectLogo = (logoUrl: string) => {
    setSelectedLogo(logoUrl);
    // Save to localStorage with version
    localStorage.setItem('pulsefind-logo-selected', logoUrl);
    localStorage.setItem('pulsefind-logo-version', 'selected-v1');
    
    toast({
      title: "Logo selected!",
      description: "Your new logo will appear throughout the app.",
    });
    
    // Navigate back to home after 1 second
    setTimeout(() => {
      navigate('/');
      window.location.reload(); // Reload to show new logo
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Choose Your Logo
            </h1>
            <p className="text-muted-foreground mb-6">
              Generate multiple logo designs and pick your favorite
            </p>
            
            <Button 
              onClick={generateLogos} 
              disabled={isGenerating}
              size="lg"
              className="bg-gradient-primary hover:opacity-90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Designs...
                </>
              ) : (
                'Generate Logo Options'
              )}
            </Button>
          </div>

          {logos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {logos.map((logo, index) => (
                <Card 
                  key={index}
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedLogo === logo 
                      ? 'ring-2 ring-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]' 
                      : ''
                  }`}
                  onClick={() => selectLogo(logo)}
                >
                  <div className="aspect-square relative rounded-xl overflow-hidden bg-gradient-primary/10 mb-4">
                    <img 
                      src={logo} 
                      alt={`Logo Design ${index + 1}`}
                      className="w-full h-full object-contain p-4"
                    />
                    {selectedLogo === logo && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-2">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <p className="text-center font-medium text-sm text-muted-foreground">
                    Design {index + 1}
                  </p>
                  <Button 
                    className="w-full mt-3" 
                    variant={selectedLogo === logo ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectLogo(logo);
                    }}
                  >
                    {selectedLogo === logo ? 'Selected' : 'Use This Logo'}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
