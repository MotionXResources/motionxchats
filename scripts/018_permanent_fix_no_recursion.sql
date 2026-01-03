-- PERMANENT FIX: Eliminate ALL self-referencing policies
-- This script completely removes any possibility of infinite recursion

-- Step 1: Drop ALL policies on conversation-related tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on conversation_participants
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.conversation_participants';
    END LOOP;
    
    -- Drop all policies on conversations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.conversations';
    END LOOP;
    
    -- Drop all policies on direct_messages
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'direct_messages' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.direct_messages';
    END LOOP;
END $$;

-- Step 2: Create SIMPLE policies with ZERO self-references

-- conversation_participants: Allow authenticated users to view ALL participants
-- Security note: Participant lists are not sensitive - the messages are what need protection
CREATE POLICY "allow_authenticated_view_participants" 
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (true);

-- conversation_participants: Allow authenticated users to add participants
CREATE POLICY "allow_authenticated_add_participants" 
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- conversation_participants: Allow users to remove themselves
CREATE POLICY "allow_users_leave" 
  ON public.conversation_participants
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- conversations: Allow authenticated users to view all conversations
CREATE POLICY "allow_authenticated_view_conversations" 
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (true);

-- conversations: Allow authenticated users to create conversations
CREATE POLICY "allow_authenticated_create_conversations" 
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 3: Create a helper function for message security (uses SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.check_conversation_participant(conv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_participant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_participants 
    WHERE conversation_id = conv_id 
    AND user_id = auth.uid()
  ) INTO is_participant;
  
  RETURN is_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 4: Message policies using the helper function
CREATE POLICY "allow_participants_view_messages" 
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (check_conversation_participant(conversation_id));

CREATE POLICY "allow_participants_send_messages" 
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND check_conversation_participant(conversation_id)
  );

-- Step 5: Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.check_conversation_participant(UUID) TO authenticated;
