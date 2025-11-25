-- Create missing_link_reports table to track user reports of missing platform links
CREATE TABLE public.missing_link_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  reported_platform TEXT NOT NULL,
  spotify_id TEXT,
  apple_music_id TEXT,
  youtube_id TEXT,
  beat_match_id UUID REFERENCES public.beat_matches(id) ON DELETE CASCADE,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.missing_link_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can insert their own reports"
ON public.missing_link_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.missing_link_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_missing_link_reports_user_id ON public.missing_link_reports(user_id);
CREATE INDEX idx_missing_link_reports_platform ON public.missing_link_reports(reported_platform);
CREATE INDEX idx_missing_link_reports_reported_at ON public.missing_link_reports(reported_at DESC);