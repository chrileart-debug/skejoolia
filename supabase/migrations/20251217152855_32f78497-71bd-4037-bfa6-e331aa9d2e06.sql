-- Create staff_services table (links staff to services they can perform)
CREATE TABLE public.staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, service_id)
);

-- Create staff_schedules table (weekly recurring schedule)
CREATE TABLE public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  is_working BOOLEAN NOT NULL DEFAULT true,
  break_start TEXT,
  break_end TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_services
CREATE POLICY "Users can view staff services in their barbershop"
ON public.staff_services FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert staff services"
ON public.staff_services FOR INSERT
WITH CHECK (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

CREATE POLICY "Owners can update staff services"
ON public.staff_services FOR UPDATE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

CREATE POLICY "Owners can delete staff services"
ON public.staff_services FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

-- RLS Policies for staff_schedules
CREATE POLICY "Users can view staff schedules in their barbershop"
ON public.staff_schedules FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert staff schedules"
ON public.staff_schedules FOR INSERT
WITH CHECK (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

CREATE POLICY "Owners can update staff schedules"
ON public.staff_schedules FOR UPDATE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

CREATE POLICY "Owners can delete staff schedules"
ON public.staff_schedules FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role));

-- Trigger for updated_at
CREATE TRIGGER update_staff_schedules_updated_at
BEFORE UPDATE ON public.staff_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();