import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Music, History, Bell, CreditCard, LogOut, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { plan } = useSubscription();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
  };

  const navItems = [
    { to: "/", label: "Beat Finder", icon: Music, show: true },
    { to: "/history", label: "History", icon: History, show: !!user },
    { to: "/notifications", label: "Notifications", icon: Bell, show: !!user && plan === "Elite" },
    { to: "/pricing", label: "Pricing", icon: CreditCard, show: true },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.filter(item => item.show).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => mobile && setIsOpen(false)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          activeClassName="text-primary bg-primary/10 font-medium"
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <NavLink
          to="/"
          className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hover:opacity-80 transition-opacity"
        >
          <Music className="h-6 w-6 text-primary" />
          <span>BeatFinder</span>
        </NavLink>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <NavLinks />
          
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="ml-2 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <NavLink to="/auth">
              <Button variant="ghost" size="sm" className="ml-2 gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </NavLink>
          )}

          {user && plan && (
            <div className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {plan}
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 bg-card">
            <div className="flex flex-col gap-4 mt-8">
              <div className="flex items-center gap-2 px-4 pb-4 border-b border-border">
                <Music className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  BeatFinder
                </span>
              </div>

              {user && plan && (
                <div className="px-4">
                  <div className="px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20 text-center">
                    {plan} Plan
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <NavLinks mobile />
              </div>

              <div className="mt-auto pt-4 border-t border-border">
                {user ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="w-full justify-start gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                ) : (
                  <NavLink to="/auth" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Button>
                  </NavLink>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
