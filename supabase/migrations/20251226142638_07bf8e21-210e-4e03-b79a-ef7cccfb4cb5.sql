-- Add is_service_provider column to user_barbershop_roles
ALTER TABLE public.user_barbershop_roles 
ADD COLUMN is_service_provider BOOLEAN DEFAULT false;

-- Set all staff members as service providers by default
UPDATE public.user_barbershop_roles 
SET is_service_provider = true 
WHERE role = 'staff';

-- Create index for better query performance
CREATE INDEX idx_user_barbershop_roles_service_provider 
ON public.user_barbershop_roles(barbershop_id, is_service_provider) 
WHERE is_service_provider = true;