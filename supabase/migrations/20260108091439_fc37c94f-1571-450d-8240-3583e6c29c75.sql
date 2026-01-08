-- Remove student-related columns from profiles table (admin-only table)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS room_no;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS fees;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS start_date;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS valid_date;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS hostel;