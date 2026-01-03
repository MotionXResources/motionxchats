-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Ensure realtime is enabled for the tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
