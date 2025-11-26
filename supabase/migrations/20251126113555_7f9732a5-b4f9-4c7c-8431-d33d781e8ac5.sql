-- Create beat_fingerprints table for local fingerprint database
CREATE TABLE IF NOT EXISTS public.beat_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Song metadata
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  isrc TEXT,
  release_date TEXT,
  
  -- Audio fingerprint data
  fingerprint_hash TEXT NOT NULL, -- Simplified audio hash for quick lookup
  mfcc_features JSONB, -- MFCC coefficients for similarity matching
  audio_duration_ms INTEGER,
  
  -- Streaming platform IDs
  spotify_id TEXT,
  apple_music_id TEXT,
  youtube_id TEXT,
  
  -- URLs
  spotify_url TEXT,
  apple_music_url TEXT,
  youtube_url TEXT,
  album_cover_url TEXT,
  preview_url TEXT,
  
  -- Metadata
  popularity INTEGER,
  confidence_score NUMERIC, -- Original ACRCloud confidence when cached
  source TEXT DEFAULT 'acrcloud', -- Where this fingerprint came from
  match_count INTEGER DEFAULT 0, -- How many times this has been matched
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_fingerprints_hash ON public.beat_fingerprints(fingerprint_hash);
CREATE INDEX idx_fingerprints_song ON public.beat_fingerprints(song_title, artist);
CREATE INDEX idx_fingerprints_isrc ON public.beat_fingerprints(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_fingerprints_spotify ON public.beat_fingerprints(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_fingerprints_popularity ON public.beat_fingerprints(popularity DESC) WHERE popularity IS NOT NULL;

-- Enable RLS
ALTER TABLE public.beat_fingerprints ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read fingerprints (needed for matching)
CREATE POLICY "Anyone can read fingerprints"
  ON public.beat_fingerprints
  FOR SELECT
  USING (true);

-- Only service role can insert/update fingerprints (via edge functions)
CREATE POLICY "Service role can manage fingerprints"
  ON public.beat_fingerprints
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to update match count
CREATE OR REPLACE FUNCTION increment_fingerprint_match_count(fingerprint_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE beat_fingerprints
  SET match_count = match_count + 1,
      updated_at = NOW()
  WHERE id = fingerprint_id;
END;
$$;

COMMENT ON TABLE public.beat_fingerprints IS 'Local fingerprint database for cached audio matches - reduces ACRCloud API calls and improves matching speed';