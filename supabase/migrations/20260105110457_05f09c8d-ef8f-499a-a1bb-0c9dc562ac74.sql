-- Fix RLS policies for barbershop-logos bucket (logo + profile photos)

-- Drop incorrect policies (if they exist)
DROP POLICY IF EXISTS "Owners can upload their logo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their logo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their logo" ON storage.objects;

-- Recreate logo policies with correct path check: {barbershop_id}/logo.jpg
CREATE POLICY "Owners can upload their logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

-- Allow users to manage their own profile photos at: profiles/{user_id}/...
DROP POLICY IF EXISTS "Users can upload their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their profile photo" ON storage.objects;

CREATE POLICY "Users can upload their profile photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(name))[1] = 'profiles'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their profile photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(name))[1] = 'profiles'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(name))[1] = 'profiles'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their profile photo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(name))[1] = 'profiles'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
