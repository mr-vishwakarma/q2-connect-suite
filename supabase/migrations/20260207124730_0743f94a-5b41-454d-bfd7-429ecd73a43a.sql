
-- Add reason column to mess_requests for leave request reason
ALTER TABLE public.mess_requests ADD COLUMN IF NOT EXISTS reason text;

-- Add admin_message column for admin response messages
ALTER TABLE public.mess_requests ADD COLUMN IF NOT EXISTS admin_message text;
