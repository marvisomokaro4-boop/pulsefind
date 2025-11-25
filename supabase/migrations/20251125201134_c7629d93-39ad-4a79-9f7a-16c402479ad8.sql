-- Add album_cover_url column to beat_matches table
ALTER TABLE public.beat_matches 
ADD COLUMN album_cover_url TEXT;