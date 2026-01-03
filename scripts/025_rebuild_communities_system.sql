-- Drop old communities system and rebuild with user-created communities

-- Delete all existing data from old system
DELETE FROM public.messages;
DELETE FROM public.chat_rooms;

-- Create community_members table
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'mod', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- Add more fields to chat_rooms for community features
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS for community_members
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Community members policies
CREATE POLICY "Anyone can view community members" 
  ON public.community_members FOR SELECT 
  USING (true);

CREATE POLICY "Community owners can add members" 
  ON public.community_members FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
    OR auth.uid() = user_id -- Users can join themselves
  );

CREATE POLICY "Users can leave communities" 
  ON public.community_members FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Community owners can remove members" 
  ON public.community_members FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Update chat_rooms policies to check membership
DROP POLICY IF EXISTS "Anyone can view chat rooms" ON public.chat_rooms;
CREATE POLICY "Anyone can view public communities" 
  ON public.chat_rooms FOR SELECT 
  USING (
    is_private = FALSE OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = id
        AND cm.user_id = auth.uid()
    )
  );

-- Update messages policies to check membership
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
CREATE POLICY "Members can view messages" 
  ON public.messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = messages.room_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
CREATE POLICY "Members can send messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = messages.room_id
        AND cm.user_id = auth.uid()
    )
  );

-- Function to auto-update member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_rooms
    SET member_count = member_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_rooms
    SET member_count = member_count - 1
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update member count
DROP TRIGGER IF EXISTS community_member_count_trigger ON public.community_members;
CREATE TRIGGER community_member_count_trigger
  AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION update_community_member_count();

-- Enable realtime for community_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members;
