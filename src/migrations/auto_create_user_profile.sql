-- Auto-create user profile when auth user is created
-- This trigger automatically creates a user_profiles entry when a user is created in auth.users

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract username and full_name from user_metadata if available
  -- Otherwise use email as username and email prefix as full_name
  INSERT INTO public.user_profiles (
    id,
    email,
    username,
    full_name,
    role,
    phone,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(
      (NEW.raw_app_meta_data->>'role')::VARCHAR(20),
      'staff'  -- Default role
    ),
    NEW.raw_user_meta_data->>'phone',
    true
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
-- Note: This must be created in Supabase SQL Editor with proper permissions
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_profiles TO postgres, anon, authenticated, service_role;

