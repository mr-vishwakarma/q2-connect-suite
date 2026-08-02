CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.mess_requests
  ADD CONSTRAINT mess_requests_reason_len CHECK (reason IS NULL OR char_length(reason) <= 2000) NOT VALID,
  ADD CONSTRAINT mess_requests_admin_message_len CHECK (admin_message IS NULL OR char_length(admin_message) <= 2000) NOT VALID;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_title_len CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT notifications_message_len CHECK (char_length(message) <= 2000) NOT VALID;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_title_len CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT complaints_description_len CHECK (char_length(description) <= 2000) NOT VALID;