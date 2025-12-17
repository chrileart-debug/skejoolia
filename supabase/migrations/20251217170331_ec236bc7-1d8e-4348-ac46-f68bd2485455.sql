-- Add new columns to clientes table for richer client data
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS last_visit timestamp with time zone;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_clientes_email ON public.clientes(email);

-- Create index on birth_date for birthday queries
CREATE INDEX IF NOT EXISTS idx_clientes_birth_date ON public.clientes(birth_date);

-- Comment for documentation
COMMENT ON COLUMN public.clientes.email IS 'Client email address for marketing/reminders';
COMMENT ON COLUMN public.clientes.birth_date IS 'Client birthday for automated birthday messages';
COMMENT ON COLUMN public.clientes.notes IS 'Internal notes about the client';
COMMENT ON COLUMN public.clientes.avatar_url IS 'Client profile picture URL';
COMMENT ON COLUMN public.clientes.last_visit IS 'Timestamp of client last appointment for retention tracking';