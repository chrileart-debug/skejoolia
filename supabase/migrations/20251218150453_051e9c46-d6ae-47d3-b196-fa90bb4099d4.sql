-- Normalize existing clientes.telefone data to digits only
UPDATE public.clientes 
SET telefone = regexp_replace(COALESCE(telefone, ''), '\D', '', 'g')
WHERE telefone IS NOT NULL 
  AND telefone ~ '[^0-9]';

-- Normalize existing agendamentos.telefone_cliente data to digits only
UPDATE public.agendamentos
SET telefone_cliente = regexp_replace(COALESCE(telefone_cliente, ''), '\D', '', 'g')
WHERE telefone_cliente IS NOT NULL 
  AND telefone_cliente ~ '[^0-9]';