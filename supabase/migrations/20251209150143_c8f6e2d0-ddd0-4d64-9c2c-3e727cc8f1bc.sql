-- Create bucket for service images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'midia-imagens-cortes',
  'midia-imagens-cortes',
  true,
  52428800, -- 50MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can view all images (public bucket)
CREATE POLICY "Public read access for service images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'midia-imagens-cortes');

-- Policy: Users can upload their own images
CREATE POLICY "Users can upload own service images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'midia-imagens-cortes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own images
CREATE POLICY "Users can update own service images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'midia-imagens-cortes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete own service images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'midia-imagens-cortes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);