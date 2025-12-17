-- Create table for multiple reminders per barbershop
CREATE TABLE public.barbershop_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('minutes', 'hours', 'days')),
  reminder_value INTEGER NOT NULL CHECK (reminder_value > 0),
  is_enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table to track sent reminders per appointment
CREATE TABLE public.appointment_reminders_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.agendamentos(id_agendamento) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.barbershop_reminders(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, reminder_id)
);

-- Enable RLS
ALTER TABLE public.barbershop_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders_sent ENABLE ROW LEVEL SECURITY;

-- RLS policies for barbershop_reminders
CREATE POLICY "Users can view barbershop reminders"
ON public.barbershop_reminders FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert barbershop reminders"
ON public.barbershop_reminders FOR INSERT
WITH CHECK (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can update barbershop reminders"
ON public.barbershop_reminders FOR UPDATE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can delete barbershop reminders"
ON public.barbershop_reminders FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- RLS policies for appointment_reminders_sent
CREATE POLICY "Users can view appointment reminders sent"
ON public.appointment_reminders_sent FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.agendamentos a
  WHERE a.id_agendamento = appointment_reminders_sent.appointment_id
  AND user_belongs_to_barbershop(auth.uid(), a.barbershop_id)
));

CREATE POLICY "Users can insert appointment reminders sent"
ON public.appointment_reminders_sent FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.agendamentos a
  WHERE a.id_agendamento = appointment_reminders_sent.appointment_id
  AND user_belongs_to_barbershop(auth.uid(), a.barbershop_id)
));

-- Create indexes for performance
CREATE INDEX idx_barbershop_reminders_barbershop ON public.barbershop_reminders(barbershop_id);
CREATE INDEX idx_appointment_reminders_sent_appointment ON public.appointment_reminders_sent(appointment_id);
CREATE INDEX idx_appointment_reminders_sent_reminder ON public.appointment_reminders_sent(reminder_id);