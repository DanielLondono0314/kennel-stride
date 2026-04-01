-- Add photo_url column to dogs table for Supabase Storage image URLs
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS photo_url text DEFAULT NULL;

-- Create storage bucket for dog photos (idempotent via insert ignore)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dog-photos',
  'dog-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload dog photos
CREATE POLICY IF NOT EXISTS "Authenticated users can upload dog photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dog-photos');

-- Allow public read of dog photos
CREATE POLICY IF NOT EXISTS "Public read dog photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dog-photos');

-- Allow authenticated users to update/delete their uploads
CREATE POLICY IF NOT EXISTS "Authenticated users can update dog photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dog-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete dog photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dog-photos');
