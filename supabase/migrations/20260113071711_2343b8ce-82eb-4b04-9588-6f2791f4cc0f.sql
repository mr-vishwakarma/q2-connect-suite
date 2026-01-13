-- Create payment_mode enum
CREATE TYPE public.payment_mode AS ENUM ('cash', 'upi', 'bank');

-- Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');

-- Create room_status enum
CREATE TYPE public.room_status AS ENUM ('available', 'full');

-- Create fees table
CREATE TABLE public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  paid_date DATE,
  payment_mode public.payment_mode DEFAULT 'upi',
  status public.payment_status DEFAULT 'unpaid',
  hostel public.hostel_type DEFAULT 'Q2',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4 NOT NULL,
  occupied_count INTEGER DEFAULT 0 NOT NULL,
  status public.room_status DEFAULT 'available',
  hostel public.hostel_type DEFAULT 'Q2',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(room_number, hostel)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  hostel public.hostel_type DEFAULT 'Q2',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Fees RLS policies
CREATE POLICY "Admins can manage all fees"
ON public.fees FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view own fees"
ON public.fees FOR SELECT
USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Rooms RLS policies
CREATE POLICY "Admins can manage all rooms"
ON public.rooms FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view rooms"
ON public.rooms FOR SELECT
USING (true);

-- Notifications RLS policies
CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_fees_updated_at
BEFORE UPDATE ON public.fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;