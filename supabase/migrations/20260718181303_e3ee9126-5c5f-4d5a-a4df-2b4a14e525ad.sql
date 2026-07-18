
-- Add "partial" to payment_status enum
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partial';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend fees table (acts as monthly_fees)
ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS late_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_no text,
  ADD COLUMN IF NOT EXISTS notes text;

-- fee_payments: each payment (supports partial)
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id uuid NOT NULL REFERENCES public.fees(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hostel hostel_type NOT NULL DEFAULT 'Q2',
  receipt_no text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  late_fee numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  security_deposit numeric NOT NULL DEFAULT 0,
  payment_mode payment_mode NOT NULL DEFAULT 'upi',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  admin_id uuid,
  admin_name text,
  month text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all payments" ON public.fee_payments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Students view own payments" ON public.fee_payments
  FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_hostel ON public.fee_payments(hostel);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee ON public.fee_payments(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON public.fee_payments(payment_date);
ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_payments;

-- security_deposits
CREATE TABLE IF NOT EXISTS public.security_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hostel hostel_type NOT NULL DEFAULT 'Q2',
  amount numeric NOT NULL DEFAULT 0,
  collected_date date,
  refund_date date,
  status text NOT NULL DEFAULT 'pending',
  payment_mode payment_mode DEFAULT 'upi',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_deposits TO authenticated;
GRANT ALL ON public.security_deposits TO service_role;
ALTER TABLE public.security_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all deposits" ON public.security_deposits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Students view own deposits" ON public.security_deposits
  FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_deposits_student ON public.security_deposits(student_id);
CREATE INDEX IF NOT EXISTS idx_deposits_hostel ON public.security_deposits(hostel);
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.security_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: generate monthly fees for all active students
CREATE OR REPLACE FUNCTION public.generate_monthly_fees()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  m TEXT := TO_CHAR(CURRENT_DATE, 'FMMonth YYYY');
  d DATE := (date_trunc('month', CURRENT_DATE) + INTERVAL '10 days')::date;
BEGIN
  FOR s IN
    SELECT id, fees, hostel, user_id, name
    FROM public.students
    WHERE fees IS NOT NULL AND fees > 0
      AND (valid_date IS NULL OR valid_date >= CURRENT_DATE)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.fees WHERE student_id = s.id AND month = m
    ) THEN
      INSERT INTO public.fees (student_id, month, amount, status, hostel, due_date)
      VALUES (s.id, m, s.fees, 'unpaid', s.hostel, d);

      INSERT INTO public.notifications (user_id, title, message, type, hostel)
      VALUES (
        s.user_id,
        'New Monthly Fee',
        'Your fee for ' || m || ' (₹' || s.fees || ') has been generated. Due: ' || TO_CHAR(d, 'DD Mon YYYY'),
        'info',
        s.hostel
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger: on payment insert, update fees.paid_amount & status + notify
CREATE OR REPLACE FUNCTION public.after_fee_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fee_row RECORD;
  total_paid numeric;
  new_status payment_status;
  stud_user uuid;
BEGIN
  SELECT * INTO fee_row FROM public.fees WHERE id = NEW.fee_id;
  SELECT COALESCE(SUM(amount),0) INTO total_paid FROM public.fee_payments WHERE fee_id = NEW.fee_id;

  IF total_paid >= (fee_row.amount + COALESCE(fee_row.late_fee,0) - COALESCE(fee_row.discount,0)) THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'unpaid';
  END IF;

  UPDATE public.fees
     SET paid_amount = total_paid,
         status = new_status,
         paid_date = CASE WHEN new_status = 'paid' THEN NEW.payment_date ELSE paid_date END,
         payment_mode = NEW.payment_mode,
         receipt_no = NEW.receipt_no
   WHERE id = NEW.fee_id;

  SELECT user_id INTO stud_user FROM public.students WHERE id = NEW.student_id;
  IF stud_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, hostel)
    VALUES (
      stud_user,
      'Payment Received',
      'Payment of ₹' || NEW.amount || ' received for ' || NEW.month || '. Receipt: ' || NEW.receipt_no,
      'success',
      NEW.hostel
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_fee_payment ON public.fee_payments;
CREATE TRIGGER trg_after_fee_payment
AFTER INSERT ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.after_fee_payment();

-- Enable pg_cron for monthly generation
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('generate-monthly-fees');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'generate-monthly-fees',
  '5 0 1 * *',
  $$SELECT public.generate_monthly_fees();$$
);
