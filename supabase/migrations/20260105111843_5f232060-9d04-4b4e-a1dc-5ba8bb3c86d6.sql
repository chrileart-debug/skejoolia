-- Fix RLS policies for barbershop-logos bucket (owner logo)
-- The issue: policies reference 'name' which conflicts with barbershops.name column
-- Solution: Use storage.objects.name explicitly

-- Drop all existing policies for this bucket first
DROP POLICY IF EXISTS "Owners can upload their logo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their logo" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their profile photo" ON storage.objects;

-- Recreate logo policies with CORRECT reference to storage.objects.name
-- Path pattern: {barbershop_id}/logo.jpg
CREATE POLICY "Owners can upload their logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
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
    WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
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
    WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
      AND b.owner_id = auth.uid()
  )
);

-- Profile photo policies: path pattern profiles/{user_id}/filename.jpg
CREATE POLICY "Users can upload their profile photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(storage.objects.name))[1] = 'profiles'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their profile photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(storage.objects.name))[1] = 'profiles'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their profile photo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbershop-logos'
  AND (storage.foldername(storage.objects.name))[1] = 'profiles'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);

-- Add avatar_url column to user_settings for persisting profile photo
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS avatar_url TEXT;