-- Enable realtime for beat_notifications table
ALTER TABLE public.beat_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.beat_notifications;