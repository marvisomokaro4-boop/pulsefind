-- Create table for tracking anonymous scans
CREATE TABLE IF NOT EXISTS public.anonymous_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  scan_count INTEGER DEFAULT 1,
  last_scan_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ip_address)
);

-- Create table for auto-alert settings
CREATE TABLE IF NOT EXISTS public.auto_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  scan_frequency TEXT DEFAULT 'daily', -- 'daily' or 'weekly'
  last_scan_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.anonymous_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anonymous_scans
CREATE POLICY "Service role can manage anonymous scans"
  ON public.anonymous_scans
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for auto_alert_settings
CREATE POLICY "Users can view their own alert settings"
  ON public.auto_alert_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert settings"
  ON public.auto_alert_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert settings"
  ON public.auto_alert_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to clean up old anonymous scan records (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_anonymous_scans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM anonymous_scans
  WHERE last_scan_at < NOW() - INTERVAL '30 days';
END;
$$;