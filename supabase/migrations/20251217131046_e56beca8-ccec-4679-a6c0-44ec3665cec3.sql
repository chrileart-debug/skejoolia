-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_barbershop_roles;

-- Create new policy that allows:
-- 1. Users to see their own roles
-- 2. Barbershop owners to see all roles in their barbershop
CREATE POLICY "Users can view roles in their barbershops"
ON public.user_barbershop_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM barbershops 
    WHERE barbershops.id = user_barbershop_roles.barbershop_id 
    AND barbershops.owner_id = auth.uid()
  )
);