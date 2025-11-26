import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import History from "./pages/History";
import AdminAnalytics from "./pages/AdminAnalytics";
import Analytics from "./pages/Analytics";
import Pricing from "./pages/Pricing";
import PaymentSuccess from "./pages/PaymentSuccess";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import TestAlerts from "./pages/TestAlerts";
import SystemErrors from "./pages/SystemErrors";
import AdminUsers from "./pages/AdminUsers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen w-full flex flex-col">
            <Navigation />
            <RouteErrorBoundary>
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/admin" element={<AdminAnalytics />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/system-errors" element={<SystemErrors />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/test-alerts" element={<TestAlerts />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </RouteErrorBoundary>
            <Footer />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </QueryClientProvider>
);

export default App;
