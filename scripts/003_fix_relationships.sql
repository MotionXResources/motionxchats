-- Drop existing foreign key constraint on messages if it exists
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

-- Add foreign key constraint that references profiles table
ALTER TABLE public.messages 
  ADD CONSTRAINT messages_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
