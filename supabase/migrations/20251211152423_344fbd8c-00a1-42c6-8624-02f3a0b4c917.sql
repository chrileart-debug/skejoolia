-- Remove the problematic foreign key constraint that references a non-existent "users" table
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- Add DELETE policy for subscriptions (needed for re-registration flow)
CREATE POLICY "Users can delete own subscription" 
ON public.subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);