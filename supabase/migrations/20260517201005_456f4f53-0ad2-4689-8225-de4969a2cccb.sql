
-- Extend mess_requests with leave document and metadata
ALTER TABLE public.mess_requests
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS document_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_mobile TEXT,
  ADD COLUMN IF NOT EXISTS approved_date TIMESTAMPTZ;

-- Add parent_phone to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- Create private storage bucket for leave documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-documents', 'leave-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: students manage their own folder; admins can read all
CREATE POLICY "Users can upload own leave documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'leave-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own leave documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'leave-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can update own leave documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'leave-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
