-- Add agent_id column to barbershop_reminders table
ALTER TABLE public.barbershop_reminders 
ADD COLUMN agent_id uuid REFERENCES public.agentes(id_agente) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_barbershop_reminders_agent_id ON public.barbershop_reminders(agent_id);