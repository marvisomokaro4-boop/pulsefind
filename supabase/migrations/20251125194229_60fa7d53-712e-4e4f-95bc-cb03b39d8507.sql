-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create beats table to store uploaded beats
CREATE TABLE public.beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on beats
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- Beats policies
CREATE POLICY "Users can view their own beats"
  ON public.beats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own beats"
  ON public.beats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beats"
  ON public.beats FOR DELETE
  USING (auth.uid() = user_id);

-- Create beat_matches table to store identification results
CREATE TABLE public.beat_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  confidence NUMERIC,
  source TEXT NOT NULL,
  spotify_id TEXT,
  spotify_url TEXT,
  apple_music_id TEXT,
  apple_music_url TEXT,
  share_url TEXT,
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on beat_matches
ALTER TABLE public.beat_matches ENABLE ROW LEVEL SECURITY;

-- Beat matches policies
CREATE POLICY "Users can view matches for their beats"
  ON public.beat_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.beats
      WHERE beats.id = beat_matches.beat_id
      AND beats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert matches for their beats"
  ON public.beat_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beats
      WHERE beats.id = beat_matches.beat_id
      AND beats.user_id = auth.uid()
    )
  );

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();