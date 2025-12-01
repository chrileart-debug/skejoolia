-- Drop and recreate view with SECURITY INVOKER to use querying user's permissions
DROP VIEW IF EXISTS public.agentes_integracoes_view;

CREATE VIEW public.agentes_integracoes_view
WITH (security_invoker = true)
AS
SELECT 
  -- Agente columns
  a.id_agente,
  a.user_id,
  a.nome AS agente_nome,
  a.funcao,
  a.sexo,
  a.tom_de_voz,
  a.objetivo,
  a.limite_caracteres,
  a.restricoes,
  a.horario_trabalho,
  a.whatsapp_id,
  a.ativo,
  a.created_at AS agente_created_at,
  a.updated_at AS agente_updated_at,
  -- Integracao WhatsApp columns
  i.id AS integracao_id,
  i.nome AS integracao_nome,
  i.numero,
  i.email,
  i.instancia,
  i.status AS integracao_status,
  i.instance_id,
  i.vinculado_em,
  i.created_at AS integracao_created_at,
  i.updated_at AS integracao_updated_at
FROM public.agentes a
LEFT JOIN public.integracao_whatsapp i ON a.whatsapp_id = i.id;