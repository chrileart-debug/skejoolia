-- Add missing columns to integracao_whatsapp table
ALTER TABLE public.integracao_whatsapp 
ADD COLUMN IF NOT EXISTS instance_id text NULL,
ADD COLUMN IF NOT EXISTS vinculado_em text NULL;

-- Update status column default to 'pendente'
ALTER TABLE public.integracao_whatsapp 
ALTER COLUMN status SET DEFAULT 'pendente';

-- Create RPC function for getting available integrations
CREATE OR REPLACE FUNCTION public.get_available_integracoes_whatsapp(p_user_id uuid, p_current_agent_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nome text,
  numero text,
  email text,
  instancia text,
  instance_id text,
  status text,
  vinculado_em text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id,
    i.user_id,
    i.nome,
    i.numero,
    i.email,
    i.instancia,
    i.instance_id,
    i.status,
    i.vinculado_em,
    i.created_at,
    i.updated_at
  FROM integracao_whatsapp i
  WHERE i.user_id = p_user_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM agentes a 
        WHERE a.whatsapp_id = i.id 
        AND a.id_agente != COALESCE(p_current_agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    );
$$;