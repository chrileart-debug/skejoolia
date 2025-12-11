-- Add cpf_cnpj column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN cpf_cnpj TEXT DEFAULT NULL;