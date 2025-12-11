-- Create enum for subscription status
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'expired', 'past_due');

-- Create plans table (centralized plan configuration)
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  max_agents INTEGER NOT NULL,
  max_whatsapp INTEGER NOT NULL,
  max_services INTEGER, -- NULL = unlimited
  max_appointments_month INTEGER, -- NULL = unlimited
  trial_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Insert plans
INSERT INTO public.plans (slug, name, price, max_agents, max_whatsapp, max_services, max_appointments_month) VALUES
('basico', 'Básico', 29.90, 1, 1, 3, 10),
('corporativo', 'Corporativo', 49.90, 5, 5, NULL, NULL);

-- Enable RLS on plans (public read)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone" 
ON public.plans FOR SELECT 
USING (true);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL REFERENCES public.plans(slug),
  status subscription_status NOT NULL DEFAULT 'trialing',
  price_at_signup NUMERIC,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  trial_expires_at TIMESTAMPTZ,
  asaas_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE(user_id)
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" 
ON public.subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" 
ON public.subscriptions FOR UPDATE 
USING (auth.uid() = user_id);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  method TEXT,
  invoice_url TEXT,
  asaas_payment_id TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" 
ON public.payments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" 
ON public.payments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create session_checkout table
CREATE TABLE public.session_checkout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_checkout_id TEXT,
  asaas_checkout_link TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Enable RLS on session_checkout
ALTER TABLE public.session_checkout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkout sessions" 
ON public.session_checkout FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkout sessions" 
ON public.session_checkout FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkout sessions" 
ON public.session_checkout FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to check user limits
CREATE OR REPLACE FUNCTION public.check_user_limit(p_user_id UUID, p_resource TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_current_count INTEGER;
  v_max_limit INTEGER;
  v_subscription subscriptions%ROWTYPE;
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
  
  -- Check limit based on resource
  CASE p_resource
    WHEN 'agents' THEN
      SELECT COUNT(*) INTO v_current_count FROM agentes WHERE user_id = p_user_id;
      v_max_limit := v_plan.max_agents;
    WHEN 'whatsapp' THEN
      SELECT COUNT(*) INTO v_current_count FROM integracao_whatsapp WHERE user_id = p_user_id;
      v_max_limit := v_plan.max_whatsapp;
    WHEN 'services' THEN
      SELECT COUNT(*) INTO v_current_count FROM cortes WHERE user_id = p_user_id;
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
$$;

-- Create trigger for updated_at on subscriptions
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on session_checkout
CREATE TRIGGER update_session_checkout_updated_at
BEFORE UPDATE ON public.session_checkout
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();