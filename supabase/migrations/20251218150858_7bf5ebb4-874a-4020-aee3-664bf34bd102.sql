-- Drop existing foreign key constraint
ALTER TABLE public.agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_client_id_fkey;

-- Add foreign key constraint with CASCADE DELETE
ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.clientes(client_id)
ON DELETE CASCADE;