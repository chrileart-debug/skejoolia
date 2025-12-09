-- Add new timestamp with time zone columns
ALTER TABLE public.agendamentos 
ADD COLUMN start_time timestamp with time zone,
ADD COLUMN end_time timestamp with time zone;

-- Migrate existing data: combine dia_do_corte and horario_corte into start_time
-- Assuming 1 hour default duration for existing appointments
UPDATE public.agendamentos 
SET 
  start_time = (dia_do_corte::text || ' ' || horario_corte::text)::timestamp AT TIME ZONE 'America/Sao_Paulo',
  end_time = ((dia_do_corte::text || ' ' || horario_corte::text)::timestamp + interval '1 hour') AT TIME ZONE 'America/Sao_Paulo'
WHERE dia_do_corte IS NOT NULL AND horario_corte IS NOT NULL;

-- Make start_time NOT NULL after migration (end_time can be nullable for flexibility)
ALTER TABLE public.agendamentos 
ALTER COLUMN start_time SET NOT NULL;

-- Drop the old columns
ALTER TABLE public.agendamentos 
DROP COLUMN dia_do_corte,
DROP COLUMN horario_corte;

-- Create index for efficient date range queries
CREATE INDEX idx_agendamentos_start_time ON public.agendamentos(start_time);
CREATE INDEX idx_agendamentos_user_start ON public.agendamentos(user_id, start_time);