-- Add is_published column to barber_plans
ALTER TABLE public.barber_plans 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN public.barber_plans.is_published IS 'Plans are drafts (false) until barbershop has active Skejool subscription';