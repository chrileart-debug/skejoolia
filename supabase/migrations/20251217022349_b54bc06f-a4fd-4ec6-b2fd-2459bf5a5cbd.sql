-- =============================================
-- FASE 1: CRIAR NOVAS ESTRUTURAS
-- =============================================

-- 1.1 Criar ENUM para roles de barbearia
CREATE TYPE public.barbershop_role AS ENUM ('owner', 'staff');

-- 1.2 Criar tabela barbershops
CREATE TABLE public.barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 1.3 Criar tabela user_barbershop_roles (separada para segurança)
CREATE TABLE public.user_barbershop_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  role barbershop_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, barbershop_id)
);

-- 1.4 Criar função security definer para verificar role
CREATE OR REPLACE FUNCTION public.has_barbershop_role(_user_id UUID, _barbershop_id UUID, _role barbershop_role DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_barbershop_roles
    WHERE user_id = _user_id
      AND barbershop_id = _barbershop_id
      AND (_role IS NULL OR role = _role)
  )
$$;

-- 1.5 Criar função para verificar se usuário pertence a alguma barbearia
CREATE OR REPLACE FUNCTION public.user_belongs_to_barbershop(_user_id UUID, _barbershop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_barbershop_roles
    WHERE user_id = _user_id
      AND barbershop_id = _barbershop_id
  )
$$;

-- 1.6 Criar tabela categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 1.7 Criar tabela services (substitui cortes)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  image_url TEXT,
  is_package BOOLEAN DEFAULT false,
  agent_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 1.8 Criar tabela service_package_items (para combos)
CREATE TABLE public.service_package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT different_services CHECK (package_id != service_id)
);

-- =============================================
-- FASE 2: HABILITAR RLS
-- =============================================

ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_barbershop_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FASE 3: POLÍTICAS RLS PARA BARBERSHOPS
-- =============================================

CREATE POLICY "Users can view barbershops they belong to"
ON public.barbershops FOR SELECT
TO authenticated
USING (public.user_belongs_to_barbershop(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Owners can insert barbershops"
ON public.barbershops FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their barbershops"
ON public.barbershops FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their barbershops"
ON public.barbershops FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- =============================================
-- FASE 4: POLÍTICAS RLS PARA USER_BARBERSHOP_ROLES
-- =============================================

CREATE POLICY "Users can view their own roles"
ON public.user_barbershop_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage roles in their barbershops"
ON public.user_barbershop_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbershops 
    WHERE id = barbershop_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update roles in their barbershops"
ON public.user_barbershop_roles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbershops 
    WHERE id = barbershop_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete roles in their barbershops"
ON public.user_barbershop_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbershops 
    WHERE id = barbershop_id AND owner_id = auth.uid()
  )
);

-- =============================================
-- FASE 5: POLÍTICAS RLS PARA CATEGORIES
-- =============================================

CREATE POLICY "Users can view categories of their barbershops"
ON public.categories FOR SELECT
TO authenticated
USING (public.user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert categories"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can update categories"
ON public.categories FOR UPDATE
TO authenticated
USING (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can delete categories"
ON public.categories FOR DELETE
TO authenticated
USING (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- =============================================
-- FASE 6: POLÍTICAS RLS PARA SERVICES
-- =============================================

CREATE POLICY "Users can view services of their barbershops"
ON public.services FOR SELECT
TO authenticated
USING (public.user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can update services"
ON public.services FOR UPDATE
TO authenticated
USING (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can delete services"
ON public.services FOR DELETE
TO authenticated
USING (public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- =============================================
-- FASE 7: POLÍTICAS RLS PARA SERVICE_PACKAGE_ITEMS
-- =============================================

CREATE POLICY "Users can view package items"
ON public.service_package_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = package_id
    AND public.user_belongs_to_barbershop(auth.uid(), s.barbershop_id)
  )
);

CREATE POLICY "Owners can insert package items"
ON public.service_package_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = package_id
    AND public.has_barbershop_role(auth.uid(), s.barbershop_id, 'owner')
  )
);

CREATE POLICY "Owners can delete package items"
ON public.service_package_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = package_id
    AND public.has_barbershop_role(auth.uid(), s.barbershop_id, 'owner')
  )
);

-- =============================================
-- FASE 8: TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_barbershops_updated_at
BEFORE UPDATE ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 9: MIGRAÇÃO DE DADOS
-- =============================================

-- 9.1 Criar barbearia para cada usuário existente
INSERT INTO public.barbershops (owner_id, name, phone, address, city, state)
SELECT 
  us.user_id,
  COALESCE(us.nome_empresa, 'Minha Barbearia'),
  us.numero,
  us.endereco,
  us.cidade,
  us.estado
FROM public.user_settings us
WHERE NOT EXISTS (
  SELECT 1 FROM public.barbershops b WHERE b.owner_id = us.user_id
);

-- 9.2 Criar role de owner para cada usuário em sua barbearia
INSERT INTO public.user_barbershop_roles (user_id, barbershop_id, role)
SELECT b.owner_id, b.id, 'owner'
FROM public.barbershops b
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_barbershop_roles r 
  WHERE r.user_id = b.owner_id AND r.barbershop_id = b.id
);

-- 9.3 Criar categoria padrão "Geral" para cada barbearia
INSERT INTO public.categories (barbershop_id, name, icon, display_order)
SELECT b.id, 'Geral', 'scissors', 0
FROM public.barbershops b
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.barbershop_id = b.id
);

-- 9.4 Migrar cortes para services
INSERT INTO public.services (
  barbershop_id, 
  category_id, 
  name, 
  description, 
  price, 
  image_url, 
  agent_enabled, 
  is_active,
  created_at,
  updated_at
)
SELECT 
  b.id,
  (SELECT c.id FROM public.categories c WHERE c.barbershop_id = b.id LIMIT 1),
  ct.nome_corte,
  ct.descricao,
  ct.preco_corte,
  ct.image_corte,
  ct.agente_pode_usar,
  true,
  ct.created_at,
  ct.updated_at
FROM public.cortes ct
JOIN public.barbershops b ON b.owner_id = ct.user_id;

-- =============================================
-- FASE 10: ATUALIZAR AGENDAMENTOS
-- =============================================

-- 10.1 Adicionar nova coluna service_id
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS service_id UUID;

-- 10.2 Migrar dados de id_corte para service_id
UPDATE public.agendamentos a
SET service_id = s.id
FROM public.cortes c
JOIN public.barbershops b ON b.owner_id = c.user_id
JOIN public.services s ON s.barbershop_id = b.id AND s.name = c.nome_corte
WHERE a.id_corte = c.id_corte;

-- 10.3 Remover coluna antiga id_corte
ALTER TABLE public.agendamentos DROP COLUMN IF EXISTS id_corte;

-- =============================================
-- FASE 11: REMOVER TABELAS ANTIGAS
-- =============================================

DROP TABLE IF EXISTS public.cortes_complementos;
DROP TABLE IF EXISTS public.complementos;
DROP TABLE IF EXISTS public.cortes;

-- =============================================
-- FASE 12: ATUALIZAR check_user_limit FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.check_user_limit(p_user_id uuid, p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan plans%ROWTYPE;
  v_current_count INTEGER;
  v_max_limit INTEGER;
  v_subscription subscriptions%ROWTYPE;
  v_barbershop_id UUID;
BEGIN
  -- Get user's active subscription
  SELECT * INTO v_subscription FROM subscriptions 
  WHERE user_id = p_user_id AND status IN ('trialing', 'active')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'current', 0, 'limit', 0);
  END IF;
  
  -- Get plan limits
  SELECT * INTO v_plan FROM plans WHERE slug = v_subscription.plan_slug;
  
  -- Get user's barbershop
  SELECT barbershop_id INTO v_barbershop_id 
  FROM user_barbershop_roles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  -- Check limit based on resource
  CASE p_resource
    WHEN 'agents' THEN
      SELECT COUNT(*) INTO v_current_count FROM agentes WHERE user_id = p_user_id;
      v_max_limit := v_plan.max_agents;
    WHEN 'whatsapp' THEN
      SELECT COUNT(*) INTO v_current_count FROM integracao_whatsapp WHERE user_id = p_user_id;
      v_max_limit := v_plan.max_whatsapp;
    WHEN 'services' THEN
      SELECT COUNT(*) INTO v_current_count FROM services WHERE barbershop_id = v_barbershop_id;
      v_max_limit := v_plan.max_services;
    WHEN 'appointments' THEN
      SELECT COUNT(*) INTO v_current_count FROM agendamentos 
      WHERE user_id = p_user_id 
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
$function$;