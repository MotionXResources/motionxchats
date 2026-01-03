-- Fix RLS policies for conversation_participants to allow users to see other participants

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON conversation_participants;

-- Create simple, working policies
-- Allow users to view all participants in conversations they're part of
CREATE POLICY "conversation_participants_select_policy" ON conversation_participants
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert participants
CREATE POLICY "conversation_participants_insert_policy" ON conversation_participants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to delete their own participation
CREATE POLICY "conversation_participants_delete_policy" ON conversation_participants
  FOR DELETE
  USING (user_id = auth.uid());
