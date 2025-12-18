-- Add public SELECT policies for barber_plans and barber_plan_items
-- Allow anyone to view active and published plans

CREATE POLICY "Public can view published barbershop plans" 
ON public.barber_plans 
FOR SELECT 
USING (is_active = true);

-- Allow anyone to view plan items for active plans
CREATE POLICY "Public can view plan items for active plans" 
ON public.barber_plan_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM barber_plans p 
    WHERE p.id = barber_plan_items.plan_id 
    AND p.is_active = true
  )
);