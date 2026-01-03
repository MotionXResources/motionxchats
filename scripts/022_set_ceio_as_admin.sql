-- Set ceio as the admin user by username
UPDATE profiles 
SET is_admin = true 
WHERE username = 'ceio';

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;
