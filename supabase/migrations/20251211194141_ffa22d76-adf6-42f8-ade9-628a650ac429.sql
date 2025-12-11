-- Add plan_name and plan_price columns to session_checkout table
ALTER TABLE public.session_checkout 
ADD COLUMN plan_name TEXT DEFAULT NULL,
ADD COLUMN plan_price NUMERIC DEFAULT NULL;