-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can upload own service images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own service images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own service images" ON storage.objects;

-- Create new policies that allow staff to manage images in owner's folder

-- INSERT: Allow users to upload to their own folder OR to their barbershop owner's folder
CREATE POLICY "Users can upload service images in barbershop folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'midia-imagens-cortes'
  AND (
    -- Own folder
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Barbershop owner's folder (staff uploading to owner's folder)
    EXISTS (
      SELECT 1 FROM public.user_barbershop_roles ubr
      JOIN public.barbershops b ON b.id = ubr.barbershop_id
      WHERE ubr.user_id = auth.uid()
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
);

-- UPDATE: Allow users to update files in their own folder OR their barbershop owner's folder
CREATE POLICY "Users can update service images in barbershop folder"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'midia-imagens-cortes'
  AND (
    -- Own folder
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Barbershop owner's folder
    EXISTS (
      SELECT 1 FROM public.user_barbershop_roles ubr
      JOIN public.barbershops b ON b.id = ubr.barbershop_id
      WHERE ubr.user_id = auth.uid()
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
);

-- DELETE: Allow users to delete files in their own folder OR their barbershop owner's folder
CREATE POLICY "Users can delete service images in barbershop folder"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'midia-imagens-cortes'
  AND (
    -- Own folder
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Barbershop owner's folder
    EXISTS (
      SELECT 1 FROM public.user_barbershop_roles ubr
      JOIN public.barbershops b ON b.id = ubr.barbershop_id
      WHERE ubr.user_id = auth.uid()
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
);