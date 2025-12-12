-- Update handle_new_user to extract name from Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_slug TEXT;
  v_plan_price NUMERIC;
  v_trial_days INTEGER;
  v_nome TEXT;
BEGIN
  -- Get plan info from metadata or default to 'basico'
  v_plan_slug := COALESCE(NEW.raw_user_meta_data ->> 'plan_slug', 'basico');
  
  -- Get name: check regular signup first, then Google OAuth fields
  v_nome := COALESCE(
    NEW.raw_user_meta_data ->> 'nome',           -- Regular signup
    NEW.raw_user_meta_data ->> 'full_name',      -- Google OAuth
    NEW.raw_user_meta_data ->> 'name'            -- Alternative Google field
  );
  
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
    v_nome,
    NEW.raw_user_meta_data ->> 'numero',
    NEW.email,
    NEW.raw_user_meta_data ->> 'nome_empresa'
  ) ON CONFLICT (user_id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, user_settings.nome),
    numero = COALESCE(EXCLUDED.numero, user_settings.numero),
    email = EXCLUDED.email,
    nome_empresa = COALESCE(EXCLUDED.nome_empresa, user_settings.nome_empresa),
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
$function$;