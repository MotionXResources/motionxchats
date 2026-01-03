-- Insert default chat rooms
INSERT INTO public.chat_rooms (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'General', 'General discussion and introductions'),
  ('00000000-0000-0000-0000-000000000002', 'Random', 'Random topics and casual chat'),
  ('00000000-0000-0000-0000-000000000003', 'Tech', 'Technology and programming discussions')
ON CONFLICT DO NOTHING;
