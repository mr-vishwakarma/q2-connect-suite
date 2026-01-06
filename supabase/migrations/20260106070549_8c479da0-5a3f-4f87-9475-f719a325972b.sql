-- Create a new students table for student-specific data
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  phone TEXT,
  room_no TEXT,
  fees NUMERIC,
  start_date DATE,
  valid_date DATE,
  hostel hostel_type DEFAULT 'Q2'::hostel_type,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for students table
CREATE POLICY "Admins can view all students"
ON public.students
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert students"
ON public.students
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update students"
ON public.students
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete students"
ON public.students
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own record"
ON public.students
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for hostel filtering
CREATE INDEX idx_students_hostel ON public.students(hostel);
CREATE INDEX idx_students_username ON public.students(username);