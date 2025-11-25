-- Create beat_notifications table for Elite users
CREATE TABLE IF NOT EXISTS public.beat_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.beat_matches(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beat_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.beat_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.beat_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_beat_notifications_user_id ON public.beat_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_beat_notifications_read ON public.beat_notifications(read) WHERE NOT read;