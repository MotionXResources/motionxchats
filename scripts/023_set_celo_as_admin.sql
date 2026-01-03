-- Set Celo as admin user
UPDATE profiles
SET is_admin = true, verified = true
WHERE username = 'Celo';

-- Verify the update
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE username = 'Celo' AND is_admin = true;
  
  IF admin_count = 0 THEN
    RAISE NOTICE 'Warning: No user found with username "Celo"';
  ELSE
    RAISE NOTICE 'Successfully set Celo as admin';
  END IF;
END $$;
