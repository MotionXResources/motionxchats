-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can create conversations based on DM permissions" ON public.conversation_participants;

-- Replace with a simple policy that allows authenticated users to add participants
-- We'll handle DM permissions in the application layer instead
CREATE POLICY "Authenticated users can add conversation participants" 
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- User can add themselves to any conversation
      user_id = auth.uid()
      OR
      -- User can add others if they are already a participant in the conversation
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
      )
    )
  );

-- Create a function to check DM permissions
CREATE OR REPLACE FUNCTION can_send_dm_to_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  allow_from TEXT;
  is_follower BOOLEAN;
BEGIN
  -- Get the target user's DM settings
  SELECT allow_dm_from INTO allow_from
  FROM public.profiles
  WHERE id = target_user_id;
  
  -- Default to everyone if not set
  IF allow_from IS NULL THEN
    allow_from := 'everyone';
  END IF;
  
  -- Check permissions
  IF allow_from = 'none' THEN
    RETURN FALSE;
  ELSIF allow_from = 'everyone' THEN
    RETURN TRUE;
  ELSIF allow_from = 'followers' THEN
    -- Check if current user follows target user
    SELECT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid()
      AND following_id = target_user_id
    ) INTO is_follower;
    
    RETURN is_follower;
  END IF;
  
  RETURN FALSE;
END;
$$;
