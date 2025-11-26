-- Add popularity column to beat_matches table to store Spotify popularity score (0-100)
ALTER TABLE public.beat_matches
ADD COLUMN IF NOT EXISTS popularity integer;

COMMENT ON COLUMN public.beat_matches.popularity IS 'Spotify popularity score (0-100) indicating track popularity based on recent play counts';