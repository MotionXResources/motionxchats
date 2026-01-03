-- Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set your account as admin (replace with your actual user ID)
-- Users can update this later via SQL or Supabase dashboard
UPDATE profiles SET is_admin = true WHERE id = auth.uid();

-- Update posts RLS policy to allow admins to delete any post
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts or admins can delete any" ON posts
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Update comments RLS policy to allow admins to delete any comment
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments or admins can delete any" ON comments
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
