-- Auto-create user profile when auth user is created
-- This trigger automatically inserts a row into public.users when someone signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, primary_role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'student', -- Default new users to student role
    NOW()
  );
  
  -- Also add them to the student role in user_roles
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'student';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
