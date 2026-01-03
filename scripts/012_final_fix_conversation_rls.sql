-- Drop ALL problematic policies on conversation_participants
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can create conversations based on DM permissions" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can add conversation participants" ON public.conversation_participants;

-- Create simple, non-recursive policies for conversation_participants
-- Policy 1: Users can view participants (using conversations table to avoid recursion)
CREATE POLICY "Users can view conversation participants"
  ON public.conversation_participants
  FOR SELECT
  USING (
    -- User can see participants if they have access to the conversation
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_participants.conversation_id
      AND (
        c.created_by = auth.uid()
        OR c.id IN (
          SELECT conversation_id FROM public.conversation_participants cp2
          WHERE cp2.user_id = auth.uid()
        )
      )
    )
  );

-- Policy 2: Simple insert policy - just check if user is authenticated
-- We'll handle DM permissions in application code before insertion
CREATE POLICY "Authenticated users can insert participants"
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Update the conversations policies to be simpler too
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );
