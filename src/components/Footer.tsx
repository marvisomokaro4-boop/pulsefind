import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>© {currentYear} PulseFind. Created by Marvelous. Made with</span>
            <Heart className="w-4 h-4 fill-primary text-primary" />
          </div>
          
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link 
              to="/about" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link 
              to="/feedback" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Feedback
            </Link>
            <Link 
              to="/terms" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              to="/privacy" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
