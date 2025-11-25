import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Music, History, Bell, CreditCard, LogOut, LogIn, Settings, User, MessageSquare, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { plan } = useSubscription();
  const navigate = useNavigate();

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
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const navItems = [
    { to: "/", label: "Beat Finder", icon: Music, show: true },
    { to: "/history", label: "History", icon: History, show: !!user },
    { to: "/notifications", label: "Notifications", icon: Bell, show: !!user && plan === "Elite" },
    { to: "/pricing", label: "Pricing", icon: CreditCard, show: true },
    { to: "/about", label: "About", icon: Info, show: true },
    { to: "/feedback", label: "Feedback", icon: MessageSquare, show: true },
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
            <div className="flex items-center gap-2 ml-2">
              {plan && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {plan}
                </div>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">My Account</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <NavLink to="/auth">
              <Button variant="ghost" size="sm" className="ml-2 gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </NavLink>
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
