-- Create hostel enum type
CREATE TYPE public.hostel_type AS ENUM ('Q2', 'Q2.0', 'Q2.1');

-- Add hostel column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN hostel public.hostel_type DEFAULT 'Q2';

-- Add hostel column to complaints table
ALTER TABLE public.complaints 
ADD COLUMN hostel public.hostel_type DEFAULT 'Q2';

-- Add hostel column to suggestions table
ALTER TABLE public.suggestions 
ADD COLUMN hostel public.hostel_type DEFAULT 'Q2';

-- Add hostel column to attendance table
ALTER TABLE public.attendance 
ADD COLUMN hostel public.hostel_type DEFAULT 'Q2';

-- Add hostel column to mess_requests table
ALTER TABLE public.mess_requests 
ADD COLUMN hostel public.hostel_type DEFAULT 'Q2';

-- Create index for faster hostel filtering
CREATE INDEX idx_profiles_hostel ON public.profiles(hostel);
CREATE INDEX idx_complaints_hostel ON public.complaints(hostel);
CREATE INDEX idx_suggestions_hostel ON public.suggestions(hostel);
CREATE INDEX idx_attendance_hostel ON public.attendance(hostel);
CREATE INDEX idx_mess_requests_hostel ON public.mess_requests(hostel);