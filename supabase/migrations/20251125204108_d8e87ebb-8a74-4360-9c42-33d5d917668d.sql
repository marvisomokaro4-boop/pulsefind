-- Add YouTube Music columns to beat_matches table
ALTER TABLE public.beat_matches 
ADD COLUMN IF NOT EXISTS youtube_id text,
ADD COLUMN IF NOT EXISTS youtube_url text;