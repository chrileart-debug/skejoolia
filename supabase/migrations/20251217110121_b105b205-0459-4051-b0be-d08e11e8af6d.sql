-- Add barbershop_id to all business tables

-- 1. agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

-- Populate existing records with barbershop from user_barbershop_roles
UPDATE public.agendamentos a
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE a.user_id = ubr.user_id;

-- Make NOT NULL after population
ALTER TABLE public.agendamentos ALTER COLUMN barbershop_id SET NOT NULL;

-- 2. clientes
ALTER TABLE public.clientes 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.clientes c
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE c.user_id = ubr.user_id;

ALTER TABLE public.clientes ALTER COLUMN barbershop_id SET NOT NULL;

-- 3. subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.subscriptions s
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE s.user_id = ubr.user_id;

ALTER TABLE public.subscriptions ALTER COLUMN barbershop_id SET NOT NULL;

-- 4. payments
ALTER TABLE public.payments 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.payments p
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE p.user_id = ubr.user_id;

ALTER TABLE public.payments ALTER COLUMN barbershop_id SET NOT NULL;

-- 5. session_checkout
ALTER TABLE public.session_checkout 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.session_checkout sc
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE sc.user_id = ubr.user_id;

ALTER TABLE public.session_checkout ALTER COLUMN barbershop_id SET NOT NULL;

-- 6. agentes
ALTER TABLE public.agentes 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.agentes ag
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE ag.user_id = ubr.user_id;

ALTER TABLE public.agentes ALTER COLUMN barbershop_id SET NOT NULL;

-- 7. integracao_whatsapp
ALTER TABLE public.integracao_whatsapp 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.integracao_whatsapp iw
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE iw.user_id = ubr.user_id;

ALTER TABLE public.integracao_whatsapp ALTER COLUMN barbershop_id SET NOT NULL;

-- 8. memoria
ALTER TABLE public.memoria 
ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE;

UPDATE public.memoria m
SET barbershop_id = ubr.barbershop_id
FROM public.user_barbershop_roles ubr
WHERE m.user_id = ubr.user_id;

ALTER TABLE public.memoria ALTER COLUMN barbershop_id SET NOT NULL;

-- Drop old RLS policies and create new ones based on barbershop membership

-- agendamentos
DROP POLICY IF EXISTS "Users can delete own appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Users can insert own appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Users can update own appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Users can view own appointments" ON public.agendamentos;

CREATE POLICY "Users can view barbershop appointments" ON public.agendamentos
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop appointments" ON public.agendamentos
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop appointments" ON public.agendamentos
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop appointments" ON public.agendamentos
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- clientes
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can view own clients" ON public.clientes;

CREATE POLICY "Users can view barbershop clients" ON public.clientes
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop clients" ON public.clientes
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop clients" ON public.clientes
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop clients" ON public.clientes
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- subscriptions
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

CREATE POLICY "Users can view barbershop subscription" ON public.subscriptions
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop subscription" ON public.subscriptions
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop subscription" ON public.subscriptions
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop subscription" ON public.subscriptions
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- payments
DROP POLICY IF EXISTS "Authenticated users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view own payments" ON public.payments;

CREATE POLICY "Users can view barbershop payments" ON public.payments
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop payments" ON public.payments
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- session_checkout
DROP POLICY IF EXISTS "Users can insert own checkout sessions" ON public.session_checkout;
DROP POLICY IF EXISTS "Users can update own checkout sessions" ON public.session_checkout;
DROP POLICY IF EXISTS "Users can view own checkout sessions" ON public.session_checkout;

CREATE POLICY "Users can view barbershop checkout sessions" ON public.session_checkout
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop checkout sessions" ON public.session_checkout
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop checkout sessions" ON public.session_checkout
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- agentes
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agentes;
DROP POLICY IF EXISTS "Users can insert own agents" ON public.agentes;
DROP POLICY IF EXISTS "Users can update own agents" ON public.agentes;
DROP POLICY IF EXISTS "Users can view own agents" ON public.agentes;

CREATE POLICY "Users can view barbershop agents" ON public.agentes
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop agents" ON public.agentes
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop agents" ON public.agentes
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop agents" ON public.agentes
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- integracao_whatsapp
DROP POLICY IF EXISTS "Users can delete own integrations" ON public.integracao_whatsapp;
DROP POLICY IF EXISTS "Users can insert own integrations" ON public.integracao_whatsapp;
DROP POLICY IF EXISTS "Users can update own integrations" ON public.integracao_whatsapp;
DROP POLICY IF EXISTS "Users can view own integrations" ON public.integracao_whatsapp;

CREATE POLICY "Users can view barbershop integrations" ON public.integracao_whatsapp
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop integrations" ON public.integracao_whatsapp
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop integrations" ON public.integracao_whatsapp
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop integrations" ON public.integracao_whatsapp
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- memoria
DROP POLICY IF EXISTS "Users can delete own chat memory" ON public.memoria;
DROP POLICY IF EXISTS "Users can insert own chat memory" ON public.memoria;
DROP POLICY IF EXISTS "Users can update own chat memory" ON public.memoria;
DROP POLICY IF EXISTS "Users can view own chat memory" ON public.memoria;

CREATE POLICY "Users can view barbershop chat memory" ON public.memoria
FOR SELECT USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop chat memory" ON public.memoria
FOR INSERT WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update barbershop chat memory" ON public.memoria
FOR UPDATE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can delete barbershop chat memory" ON public.memoria
FOR DELETE USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

-- Update check_user_limit function to use barbershop_id
CREATE OR REPLACE FUNCTION public.check_user_limit(p_user_id uuid, p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_current_count INTEGER;
  v_max_limit INTEGER;
  v_subscription subscriptions%ROWTYPE;
  v_barbershop_id UUID;
BEGIN
  -- Get user's barbershop
  SELECT barbershop_id INTO v_barbershop_id 
  FROM user_barbershop_roles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  IF v_barbershop_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_barbershop', 'current', 0, 'limit', 0);
  END IF;
  
  -- Get barbershop's active subscription
  SELECT * INTO v_subscription FROM subscriptions 
  WHERE barbershop_id = v_barbershop_id AND status IN ('trialing', 'active')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'current', 0, 'limit', 0);
  END IF;
  
  -- Get plan limits
  SELECT * INTO v_plan FROM plans WHERE slug = v_subscription.plan_slug;
  
  -- Check limit based on resource
  CASE p_resource
    WHEN 'agents' THEN
      SELECT COUNT(*) INTO v_current_count FROM agentes WHERE barbershop_id = v_barbershop_id;
      v_max_limit := v_plan.max_agents;
    WHEN 'whatsapp' THEN
      SELECT COUNT(*) INTO v_current_count FROM integracao_whatsapp WHERE barbershop_id = v_barbershop_id;
      v_max_limit := v_plan.max_whatsapp;
    WHEN 'services' THEN
      SELECT COUNT(*) INTO v_current_count FROM services WHERE barbershop_id = v_barbershop_id;
      v_max_limit := v_plan.max_services;
    WHEN 'appointments' THEN
      SELECT COUNT(*) INTO v_current_count FROM agendamentos 
      WHERE barbershop_id = v_barbershop_id 
      AND start_time >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo');
      v_max_limit := v_plan.max_appointments_month;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_resource', 'current', 0, 'limit', 0);
  END CASE;
  
  -- NULL = unlimited
  IF v_max_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'current', v_current_count, 'limit', -1, 'unlimited', true);
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_current_count < v_max_limit,
    'current', v_current_count,
    'limit', v_max_limit,
    'unlimited', false
  );
END;
$$;

-- Update get_available_integracoes_whatsapp to use barbershop_id
CREATE OR REPLACE FUNCTION public.get_available_integracoes_whatsapp(p_user_id uuid, p_current_agent_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, user_id uuid, nome text, numero text, email text, instancia text, instance_id text, status text, vinculado_em text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
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
  JOIN user_barbershop_roles ubr ON i.barbershop_id = ubr.barbershop_id
  WHERE ubr.user_id = p_user_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM agentes a 
        WHERE a.whatsapp_id = i.id 
        AND a.id_agente != COALESCE(p_current_agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    );
$$;