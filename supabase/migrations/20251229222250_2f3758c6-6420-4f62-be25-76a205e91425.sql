-- Remove o trigger que dispara CAPI automaticamente ao criar user_barbershop_roles
-- Isso evita duplicação já que agora o frontend chama a Edge Function explicitamente

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_user_registration_fb_conversions ON public.user_barbershop_roles;

-- Drop the function (optional, but keeps the database clean)
DROP FUNCTION IF EXISTS public.trigger_fb_conversions_on_registration();