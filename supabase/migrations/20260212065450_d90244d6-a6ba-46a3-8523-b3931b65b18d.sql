
-- Fix: Replace public rooms read policy with authenticated-only access
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;

CREATE POLICY "Authenticated users can view rooms"
ON public.rooms FOR SELECT
USING (auth.uid() IS NOT NULL);
