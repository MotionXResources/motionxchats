-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Anyone can view likes" ON public.likes;
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;

-- Update likes policy to respect privacy settings
CREATE POLICY "Users can view likes based on privacy" ON public.likes
  FOR SELECT
  USING (
    -- User can always see their own likes
    user_id = auth.uid()
    OR
    -- Others can see likes if the post owner hasn't made likes private
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.profiles pr ON pr.id = p.user_id
      WHERE p.id = likes.post_id
      AND (pr.likes_private = false OR pr.id = auth.uid())
    )
  );

-- Update follows policy to respect privacy settings
CREATE POLICY "Users can view follows based on privacy" ON public.follows
  FOR SELECT
  USING (
    -- User can always see their own follows (as follower or following)
    follower_id = auth.uid() OR following_id = auth.uid()
    OR
    -- Others can see follows of users who haven't made followers private
    (
      -- For viewing someone's followers
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = follows.following_id
        AND pr.followers_private = false
      )
      AND
      -- For viewing who someone is following
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = follows.follower_id
        AND pr.followers_private = false
      )
    )
  );

-- Add policy to prevent unauthorized DM conversations
CREATE POLICY "Users can create conversations based on DM permissions" 
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (
    -- User can always add themselves
    user_id = auth.uid()
    OR
    -- User can add others if they allow DMs from everyone
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = conversation_participants.user_id
      AND pr.allow_dm_from = 'everyone'
    )
    OR
    -- User can add others if they allow DMs from followers and the current user follows them
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = conversation_participants.user_id
      AND pr.allow_dm_from = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.following_id = conversation_participants.user_id
        AND f.follower_id = auth.uid()
      )
    )
  );
