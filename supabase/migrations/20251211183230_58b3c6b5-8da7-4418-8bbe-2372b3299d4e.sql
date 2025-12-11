-- Add asaas_customer_id column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN asaas_customer_id TEXT DEFAULT NULL;