import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Music, Instagram, Youtube } from "lucide-react";

const About = () => {
  // Your social media links
  const socialLinks = {
    instagram: "https://www.instagram.com/marvbeats33",
    youtube: "https://www.youtube.com/@marvbeats33",
  };

  const faqs = [
    {
      question: "How does PulseFind identify my beats in songs?",
      answer: "PulseFind uses advanced audio fingerprinting technology similar to Shazam and YouTube Content ID. When you upload your beat, we analyze its unique audio signature and compare it against millions of songs across streaming platforms to find matches."
    },
    {
      question: "Which streaming platforms are supported?",
      answer: "We currently support Spotify, Apple Music, and YouTube Music. We're constantly working to add more platforms to provide comprehensive coverage of where your beats are being used."
    },
    {
      question: "How accurate is the beat matching?",
      answer: "Our matching system provides confidence scores for each result. Matches above 70% confidence are highly reliable. We analyze multiple segments of your beat to ensure comprehensive coverage and accuracy, returning up to 99 matches per scan."
    },
    {
      question: "Can I upload multiple beats at once?",
      answer: "Yes! Pro tier subscribers have access to batch upload functionality, allowing you to analyze multiple beats simultaneously and compare results side-by-side."
    },
    {
      question: "What's included in the free tier?",
      answer: "Free tier users get 1 beat upload per month with basic scan analysis and partial results. Upgrade to Pro for unlimited uploads and full feature access."
    },
    {
      question: "How do I upgrade to Pro?",
      answer: "Visit our Pricing page to view our subscription plans. Pro tier offers unlimited uploads & scans, full deep scan analysis, auto alerts, full results, and downloadable match reports for £4.99/month."
    },
    {
      question: "What happens to the first 50 signups?",
      answer: "The first 50 users to sign up receive Pro tier access completely free for 3 months! This includes unlimited uploads & scans, full deep scan, auto alerts, downloadable reports, and full scan history."
    },
    {
      question: "Can I report missing links or incorrect matches?",
      answer: "Absolutely! Each match result has a 'Report Missing Link' button. Your reports help us improve our matching algorithm and add missing platform links."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="p-6 rounded-full bg-gradient-to-br from-primary to-secondary">
            <Music className="h-16 w-16 text-background" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          About PulseFind
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The ultimate tool for producers to discover which songs use their beats across all major streaming platforms
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
            <CardDescription>Empowering music producers worldwide</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              PulseFind was created to solve a critical problem that producers face: tracking where and how their beats are being used across the music industry. Using advanced audio fingerprinting technology similar to Shazam and YouTube Content ID, we help you discover every song that incorporates your beats.
            </p>
            <p className="text-foreground">
              Whether you're an established producer or just starting out, PulseFind gives you the insights you need to understand your impact across Spotify, Apple Music, YouTube Music, and more.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Advanced Audio Fingerprinting</p>
                  <p className="text-sm text-muted-foreground">
                    Shazam-like technology to identify your beats in songs across all DSPs
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-secondary mt-2" />
                <div>
                  <p className="font-medium">Multi-Platform Coverage</p>
                  <p className="text-sm text-muted-foreground">
                    Track usage across Spotify, Apple Music, YouTube Music, and more
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-accent mt-2" />
                <div>
                  <p className="font-medium">Historical Tracking</p>
                  <p className="text-sm text-muted-foreground">
                    Maintain a complete portfolio of your beat usage over time
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Batch Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Upload multiple beats at once and compare results side-by-side
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect With Us</CardTitle>
            <CardDescription>Follow our journey and stay updated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px]"
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-[#E4405F]/10 hover:border-[#E4405F] hover:text-[#E4405F] transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                  Follow on Instagram
                </Button>
              </a>
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px]"
              >
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-[#FF0000]/10 hover:border-[#FF0000] hover:text-[#FF0000] transition-colors"
                >
                  <Youtube className="h-5 w-5" />
                  Subscribe on YouTube
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Everything you need to know about PulseFind</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardHeader>
            <CardTitle>Special Launch Offer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-4">
              <strong>First 50 signups get Pro tier FREE for 3 months!</strong> Get unlimited uploads & scans, full deep scan, auto alerts, downloadable reports, and full scan history.
            </p>
            <Button 
              onClick={() => window.location.href = '/auth'}
              className="w-full sm:w-auto"
            >
              Sign Up Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default About;
