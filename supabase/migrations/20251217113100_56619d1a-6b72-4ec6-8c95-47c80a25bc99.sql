-- Update handle_new_user function to include barbershop_id in subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug TEXT;
  v_plan_price NUMERIC;
  v_trial_days INTEGER;
  v_nome TEXT;
  v_nome_empresa TEXT;
  v_barbershop_id UUID;
BEGIN
  -- Get plan info from metadata or default to 'basico'
  v_plan_slug := COALESCE(NEW.raw_user_meta_data ->> 'plan_slug', 'basico');
  
  -- Get name: check regular signup first, then Google OAuth fields
  v_nome := COALESCE(
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  
  -- Get company name from metadata
  v_nome_empresa := NEW.raw_user_meta_data ->> 'nome_empresa';
  
  -- Get plan details
  SELECT price, trial_days INTO v_plan_price, v_trial_days
  FROM plans WHERE slug = v_plan_slug;
  
  -- Default values if plan not found
  v_plan_price := COALESCE(v_plan_price, 29.90);
  v_trial_days := COALESCE(v_trial_days, 7);
  
  -- Create barbershop for new user FIRST (need barbershop_id for other inserts)
  INSERT INTO public.barbershops (
    owner_id,
    name
  ) VALUES (
    NEW.id,
    COALESCE(v_nome_empresa, 'Minha Barbearia')
  )
  RETURNING id INTO v_barbershop_id;

  -- Create user_settings (profile data only)
  INSERT INTO public.user_settings (
    user_id,
    nome,
    numero,
    email
  ) VALUES (
    NEW.id,
    v_nome,
    NEW.raw_user_meta_data ->> 'numero',
    NEW.email
  ) ON CONFLICT (user_id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, user_settings.nome),
    numero = COALESCE(EXCLUDED.numero, user_settings.numero),
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Create user_barbershop_roles entry
  INSERT INTO public.user_barbershop_roles (
    user_id,
    barbershop_id,
    role
  ) VALUES (
    NEW.id,
    v_barbershop_id,
    'owner'
  );

  -- Create default category for the barbershop
  INSERT INTO public.categories (
    barbershop_id,
    name,
    display_order
  ) VALUES (
    v_barbershop_id,
    'Geral',
    0
  );

  -- Create subscription with selected plan (now includes barbershop_id)
  INSERT INTO public.subscriptions (
    user_id,
    barbershop_id,
    plan_slug,
    status,
    price_at_signup,
    trial_started_at,
    trial_expires_at
  ) VALUES (
    NEW.id,
    v_barbershop_id,
    v_plan_slug,
    'trialing',
    v_plan_price,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL
  ) ON CONFLICT (user_id) DO UPDATE SET
    barbershop_id = EXCLUDED.barbershop_id,
    plan_slug = EXCLUDED.plan_slug,
    price_at_signup = EXCLUDED.price_at_signup,
    updated_at = NOW();

  RETURN NEW;
END;
$$;