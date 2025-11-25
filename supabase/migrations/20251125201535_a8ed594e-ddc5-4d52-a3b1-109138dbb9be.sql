-- Add preview_url column to beat_matches table
ALTER TABLE public.beat_matches 
ADD COLUMN preview_url TEXT;