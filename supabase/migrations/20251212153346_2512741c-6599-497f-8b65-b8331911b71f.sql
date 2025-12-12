-- First, let's ensure RLS is enabled (should already be, but confirming)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with explicit authentication checks
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- Recreate policies with explicit authentication requirement
-- These policies ensure ONLY authenticated users can access ONLY their own data
-- Anonymous users (auth.uid() = NULL) will be blocked automatically

CREATE POLICY "Authenticated users can view own settings" 
ON public.user_settings 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own settings" 
ON public.user_settings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own settings" 
ON public.user_settings 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own settings" 
ON public.user_settings 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Explicitly deny anonymous access by not creating any policies for 'anon' role
-- This ensures the table is completely inaccessible to unauthenticated users