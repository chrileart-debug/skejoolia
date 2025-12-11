-- Add column to track if agent is active for this client
ALTER TABLE public.clientes 
ADD COLUMN agente_ativo boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.clientes.agente_ativo IS 'Indicates if the AI agent is enabled for this client';