-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  stripe_price_id text UNIQUE,
  price_monthly numeric NOT NULL,
  scans_per_day integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamp with time zone,
  trial_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Create scan_usage table to track daily usage
CREATE TABLE public.scan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scan_date date NOT NULL DEFAULT CURRENT_DATE,
  scan_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, scan_date)
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans"
ON public.subscription_plans
FOR SELECT
USING (true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for scan_usage
CREATE POLICY "Users can view their own scan usage"
ON public.scan_usage
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scan usage"
ON public.scan_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scan usage"
ON public.scan_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, price_monthly, scans_per_day, features) VALUES
('Free', 0, 3, '[
  "3 scans per day",
  "Basic recognition (song title, artist, score)",
  "Limited BPM/key preview"
]'::jsonb),
('Pro', 10, 50, '[
  "50 scans per day",
  "Full recognition with confidence score",
  "BPM + Key detection",
  "Similar song / vibe matching",
  "Sample/copyright detection",
  "7-day free trial"
]'::jsonb),
('Elite', 20, -1, '[
  "Unlimited scans",
  "Everything in Pro",
  "Bulk upload / scan",
  "Notifications if beat is used in a song",
  "Priority support"
]'::jsonb);

-- Function to get or create today's scan usage
CREATE OR REPLACE FUNCTION public.get_scan_usage(_user_id uuid)
RETURNS TABLE (scan_count integer, scans_per_day integer) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_count integer;
  v_scans_per_day integer;
BEGIN
  -- Get user's plan limit
  SELECT sp.scans_per_day INTO v_scans_per_day
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = _user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now());
  
  -- If no active subscription, use Free tier
  IF v_scans_per_day IS NULL THEN
    SELECT sp.scans_per_day INTO v_scans_per_day
    FROM subscription_plans sp
    WHERE sp.name = 'Free';
  END IF;
  
  -- Get or create today's usage
  INSERT INTO scan_usage (user_id, scan_date, scan_count)
  VALUES (_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) 
  DO NOTHING;
  
  SELECT su.scan_count INTO v_scan_count
  FROM scan_usage su
  WHERE su.user_id = _user_id 
    AND su.scan_date = CURRENT_DATE;
  
  RETURN QUERY SELECT v_scan_count, v_scans_per_day;
END;
$$;

-- Function to increment scan count
CREATE OR REPLACE FUNCTION public.increment_scan_count(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_limit integer;
BEGIN
  -- Get current usage
  SELECT scan_count, scans_per_day INTO v_current_count, v_limit
  FROM get_scan_usage(_user_id);
  
  -- Check if unlimited (-1) or under limit
  IF v_limit = -1 OR v_current_count < v_limit THEN
    UPDATE scan_usage
    SET scan_count = scan_count + 1,
        updated_at = now()
    WHERE user_id = _user_id 
      AND scan_date = CURRENT_DATE;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Trigger to automatically assign Free plan to new users
CREATE OR REPLACE FUNCTION public.assign_free_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_plan_id uuid;
BEGIN
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE name = 'Free';
  
  INSERT INTO user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, v_free_plan_id, 'active');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_assign_free_plan
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_free_plan();