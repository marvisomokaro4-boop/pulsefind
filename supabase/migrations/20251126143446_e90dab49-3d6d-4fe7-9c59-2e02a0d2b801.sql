-- Create scan_analytics table for tracking metrics
CREATE TABLE IF NOT EXISTS public.scan_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  beat_id UUID REFERENCES public.beats(id),
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Performance metrics
  total_duration_ms INTEGER NOT NULL,
  preprocessing_duration_ms INTEGER,
  fingerprint_duration_ms INTEGER,
  matching_duration_ms INTEGER,
  
  -- Scan details
  segments_analyzed INTEGER NOT NULL,
  segments_successful INTEGER NOT NULL,
  matching_mode TEXT NOT NULL, -- 'strict' or 'loose'
  
  -- Results metrics
  total_matches_found INTEGER NOT NULL DEFAULT 0,
  avg_confidence_score NUMERIC(5,4),
  max_confidence_score NUMERIC(5,4),
  min_confidence_score NUMERIC(5,4),
  
  -- Quality metrics
  audio_quality_score NUMERIC(5,4),
  silence_trimmed_ms INTEGER,
  volume_normalized BOOLEAN DEFAULT false,
  
  -- Platform breakdown
  acrcloud_matches INTEGER DEFAULT 0,
  youtube_matches INTEGER DEFAULT 0,
  spotify_matches INTEGER DEFAULT 0,
  local_cache_hit BOOLEAN DEFAULT false,
  
  -- Error tracking
  errors_encountered INTEGER DEFAULT 0,
  error_messages TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient analytics queries
CREATE INDEX idx_scan_analytics_user_date ON public.scan_analytics(user_id, scan_date DESC);
CREATE INDEX idx_scan_analytics_beat ON public.scan_analytics(beat_id);
CREATE INDEX idx_scan_analytics_performance ON public.scan_analytics(total_duration_ms);

-- Enable RLS
ALTER TABLE public.scan_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own analytics"
  ON public.scan_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics"
  ON public.scan_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics"
  ON public.scan_analytics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));