import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Bug, Lightbulb } from "lucide-react";

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "general"], {
    required_error: "Please select a feedback type",
  }),
  subject: z
    .string()
    .trim()
    .min(5, { message: "Subject must be at least 5 characters" })
    .max(200, { message: "Subject must be less than 200 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, { message: "Message must be at least 10 characters" })
    .max(2000, { message: "Message must be less than 2000 characters" }),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const Feedback = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: "general",
      subject: "",
      email: "",
      message: "",
    },
  });

  const feedbackType = watch("type");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        setValue("email", session.user.email);
      }
    });
  }, [setValue]);

  const onSubmit = async (data: FeedbackFormData) => {
    setLoading(true);

    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        email: data.email || user?.email || null,
        type: data.type,
        subject: data.subject,
        message: data.message,
        status: "new",
      });

      if (error) throw error;

      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it shortly.",
      });

      reset();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const typeIcons = {
    bug: Bug,
    feature: Lightbulb,
    general: MessageSquare,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Feedback & Support</h1>
      <p className="text-muted-foreground mb-8">
        Report bugs, suggest features, or share your thoughts with us
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
          <CardDescription>
            We value your input and use it to improve PulseFind
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label>Feedback Type *</Label>
              <RadioGroup
                value={feedbackType}
                onValueChange={(value) => setValue("type", value as any)}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="bug" id="bug" />
                  <Label
                    htmlFor="bug"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Bug className="h-4 w-4 text-destructive" />
                    <div>
                      <div className="font-medium">Bug Report</div>
                      <div className="text-sm text-muted-foreground">
                        Something isn't working correctly
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="feature" id="feature" />
                  <Label
                    htmlFor="feature"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">Feature Request</div>
                      <div className="text-sm text-muted-foreground">
                        Suggest a new feature or improvement
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="general" id="general" />
                  <Label
                    htmlFor="general"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <MessageSquare className="h-4 w-4 text-accent" />
                    <div>
                      <div className="font-medium">General Feedback</div>
                      <div className="text-sm text-muted-foreground">
                        Share your thoughts or ask questions
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Brief description of your feedback"
                {...register("subject")}
                maxLength={200}
              />
              {errors.subject && (
                <p className="text-sm text-destructive">{errors.subject.message}</p>
              )}
            </div>

            {!user && (
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register("email")}
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  Provide your email if you'd like us to follow up
                </p>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Provide details about your feedback..."
                rows={6}
                {...register("message")}
                maxLength={2000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {watch("message")?.length || 0} / 2000
              </p>
              {errors.message && (
                <p className="text-sm text-destructive">{errors.message.message}</p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Feedback
            </Button>
          </form>
        </CardContent>
      </Card>

      {user && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Your Previous Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View and track your submitted feedback in your{" "}
              <a href="/profile" className="text-primary hover:underline">
                profile page
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Feedback;
