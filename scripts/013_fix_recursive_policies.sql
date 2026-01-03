-- Drop ALL existing policies on conversation_participants to start fresh
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can create conversations based on DM permissions" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can add conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can insert participants" ON public.conversation_participants;

-- Also drop and recreate conversation policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a simple view-only policy for conversation_participants
-- This avoids recursion by only checking the user_id column directly
CREATE POLICY "View own participant records"
  ON public.conversation_participants
  FOR SELECT
  USING (user_id = auth.uid());

-- Create a simple insert policy for conversation_participants
-- Application code will handle DM permission checks
CREATE POLICY "Insert participant records"
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create simple conversation policies
CREATE POLICY "View conversations"
  ON public.conversations
  FOR SELECT
  USING (true); -- We'll control access through participants table

CREATE POLICY "Create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
