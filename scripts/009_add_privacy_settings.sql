-- Add privacy columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS likes_private BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS followers_private BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_dm_from VARCHAR(20) DEFAULT 'everyone' CHECK (allow_dm_from IN ('everyone', 'followers', 'none'));

-- Create index for faster privacy checks
CREATE INDEX IF NOT EXISTS idx_profiles_privacy ON public.profiles(likes_private, followers_private, allow_dm_from);

-- Add helpful comment
COMMENT ON COLUMN public.profiles.likes_private IS 'When true, only the user can see their liked posts';
COMMENT ON COLUMN public.profiles.followers_private IS 'When true, only the user can see their followers/following lists';
COMMENT ON COLUMN public.profiles.allow_dm_from IS 'Controls who can send DMs: everyone, followers, or none';
