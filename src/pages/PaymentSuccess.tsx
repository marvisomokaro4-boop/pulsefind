import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles, Zap, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PulseFindLogo } from "@/components/PulseFindLogo";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { plan, scansPerDay, refreshSubscription } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    // Refresh subscription status after payment
    const refreshStatus = async () => {
      await refreshSubscription();
      setIsRefreshing(false);
    };

    // Give Stripe a moment to process the webhook
    const timer = setTimeout(refreshStatus, 2000);
    return () => clearTimeout(timer);
  }, [refreshSubscription]);

  const proFeatures = [
    {
      icon: Zap,
      title: "Unlimited Uploads",
      description: "Upload and scan as many beats as you want"
    },
    {
      icon: Sparkles,
      title: "Full Deep Scan",
      description: "Get comprehensive analysis of every beat"
    },
    {
      icon: CheckCircle2,
      title: "Auto Alerts",
      description: "Get notified when your beats are used"
    },
    {
      icon: Crown,
      title: "Complete Features",
      description: "Full result list, downloadable reports, and scan history"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <PulseFindLogo size="sm" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 animate-pulse">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Payment Successful!</h1>
            <p className="text-xl text-muted-foreground mb-6">
              Welcome to PulseFind Pro
            </p>
            {!isRefreshing && (
              <Badge variant="default" className="text-lg px-4 py-2">
                <Crown className="w-4 h-4 mr-2" />
                {plan} Plan Active
              </Badge>
            )}
          </div>

          {/* Account Details */}
          <Card className="mb-8 border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Your Pro Account
              </CardTitle>
              <CardDescription>
                Your subscription is now active and ready to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription Plan</p>
                    <p className="text-lg font-semibold">Pro</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Uploads</p>
                    <p className="text-lg font-semibold">Unlimited</p>
                  </div>
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Billing</p>
                    <p className="text-lg font-semibold">£4.99/month</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Approx. $6.99 USD</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Overview */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-center">What You Get with Pro</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {proFeatures.map((feature, index) => (
                <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center space-y-4">
            <Button 
              size="lg" 
              onClick={() => navigate("/")}
              className="w-full md:w-auto"
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Scanning Beats
            </Button>
            <p className="text-sm text-muted-foreground">
              Ready to discover who's using your beats? Upload your first beat now!
            </p>
          </div>

          {/* Additional Info */}
          <Card className="mt-8 bg-muted/30 border-border">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Need help? Contact us or visit the{" "}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => navigate("/about")}
                  >
                    About page
                  </Button>
                  {" "}for more information.
                </p>
                <p className="text-sm text-muted-foreground">
                  You can manage your subscription anytime from{" "}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => navigate("/pricing")}
                  >
                    Pricing
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
