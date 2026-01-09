-- Add email column to user_profiles table
-- This migration adds email to user_profiles so it's stored alongside other profile data

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Update existing profiles with email from auth.users
UPDATE user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND up.email IS NULL;

-- Make email NOT NULL after backfilling (optional - comment out if you want to allow NULL)
-- ALTER TABLE user_profiles ALTER COLUMN email SET NOT NULL;

-- Add comment
COMMENT ON COLUMN user_profiles.email IS 'User email address, synced from auth.users';

