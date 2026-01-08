-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create new function that only creates profiles for admin users (not students)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create profile if the email domain is for admins (q2hostel.local)
  -- Students use q2student.local and should NOT have profiles created
  IF NEW.email LIKE '%@q2hostel.local' THEN
    INSERT INTO public.profiles (user_id, name, email, username)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email), 
      NEW.email,
      SPLIT_PART(NEW.email, '@', 1)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clean up: Delete any existing student profiles that were mistakenly created
DELETE FROM public.profiles 
WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'student'
);