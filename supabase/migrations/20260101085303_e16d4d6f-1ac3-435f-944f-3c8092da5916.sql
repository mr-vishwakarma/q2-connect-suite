-- Add username field to profiles for User ID login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Add is_primary field to user_roles for distinguishing primary vs secondary admins
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Update RLS policy to allow admins to view all roles (including is_primary)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update roles (for is_primary field)
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add student role to app_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'student' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'student';
  END IF;
END
$$;