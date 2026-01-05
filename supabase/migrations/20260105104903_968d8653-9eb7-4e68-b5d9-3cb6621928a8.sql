-- Update storage buckets to enforce 1MB file size limit
UPDATE storage.buckets 
SET file_size_limit = 1048576, -- 1MB in bytes
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'midia-imagens-cortes';

UPDATE storage.buckets 
SET file_size_limit = 1048576, -- 1MB in bytes
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'barbershop-logos';