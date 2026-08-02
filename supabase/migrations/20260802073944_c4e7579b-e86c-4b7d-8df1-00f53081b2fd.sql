REVOKE ALL ON FUNCTION public.generate_monthly_fees() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.after_fee_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;