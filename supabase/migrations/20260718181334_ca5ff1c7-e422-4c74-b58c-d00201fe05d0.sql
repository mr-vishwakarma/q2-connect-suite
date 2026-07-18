
REVOKE ALL ON FUNCTION public.generate_monthly_fees() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.after_fee_payment() FROM PUBLIC, anon, authenticated;
