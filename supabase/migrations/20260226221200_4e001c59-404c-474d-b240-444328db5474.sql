
-- Add media_items column to calendar_items
ALTER TABLE public.calendar_items ADD COLUMN IF NOT EXISTS media_items jsonb DEFAULT '[]'::jsonb;

-- Create media-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for media-files bucket
CREATE POLICY "Anyone can view media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-files');

CREATE POLICY "Authenticated users can upload media files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update media files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'media-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete media files"
ON storage.objects FOR DELETE
USING (bucket_id = 'media-files' AND auth.role() = 'authenticated');
