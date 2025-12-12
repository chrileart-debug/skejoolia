-- Ensure RLS is enabled on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with explicit authentication
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;

-- Recreate policies with explicit TO authenticated clause
CREATE POLICY "Authenticated users can view own payments" 
ON public.payments 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own payments" 
ON public.payments 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);