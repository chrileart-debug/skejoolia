-- Add reminder settings to barbershops table
ALTER TABLE public.barbershops
ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS reminder_message_template TEXT,
ADD COLUMN IF NOT EXISTS webhook_reminders_enabled BOOLEAN DEFAULT false;

-- Add reminder_sent to agendamentos table
ALTER TABLE public.agendamentos
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_agendamentos_reminder_pending 
ON public.agendamentos (start_time, reminder_sent) 
WHERE reminder_sent = false AND status != 'cancelled';