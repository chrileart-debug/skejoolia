-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan_slug TEXT;
  v_plan_price NUMERIC;
  v_trial_days INTEGER;
BEGIN
  -- Get plan info from metadata or default to 'basico'
  v_plan_slug := COALESCE(NEW.raw_user_meta_data ->> 'plan_slug', 'basico');
  
  -- Get plan details
  SELECT price, trial_days INTO v_plan_price, v_trial_days
  FROM plans WHERE slug = v_plan_slug;
  
  -- Default values if plan not found
  v_plan_price := COALESCE(v_plan_price, 29.90);
  v_trial_days := COALESCE(v_trial_days, 7);
  
  -- Create user_settings with metadata
  INSERT INTO public.user_settings (
    user_id,
    nome,
    numero,
    email,
    nome_empresa
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'numero',
    NEW.email,
    NEW.raw_user_meta_data ->> 'nome_empresa'
  ) ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    numero = EXCLUDED.numero,
    email = EXCLUDED.email,
    nome_empresa = EXCLUDED.nome_empresa,
    updated_at = NOW();

  -- Create subscription with selected plan
  INSERT INTO public.subscriptions (
    user_id,
    plan_slug,
    status,
    price_at_signup,
    trial_started_at,
    trial_expires_at
  ) VALUES (
    NEW.id,
    v_plan_slug,
    'trialing',
    v_plan_price,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL
  ) ON CONFLICT (user_id) DO UPDATE SET
    plan_slug = EXCLUDED.plan_slug,
    price_at_signup = EXCLUDED.price_at_signup,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add unique constraint on user_id for user_settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_key'
  ) THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;