-- Add release_date column to beat_matches table
ALTER TABLE public.beat_matches 
ADD COLUMN release_date TEXT;