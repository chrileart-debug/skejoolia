-- Create storage bucket for barbershop logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('barbershop-logos', 'barbershop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for logo uploads
CREATE POLICY "Logo images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'barbershop-logos');

CREATE POLICY "Owners can upload their logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'barbershop-logos' 
  AND EXISTS (
    SELECT 1 FROM barbershops 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'barbershop-logos' 
  AND EXISTS (
    SELECT 1 FROM barbershops 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'barbershop-logos' 
  AND EXISTS (
    SELECT 1 FROM barbershops 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);