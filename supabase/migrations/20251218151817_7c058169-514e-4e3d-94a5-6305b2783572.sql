-- Fix ambiguous client_id reference in handle_public_booking function
CREATE OR REPLACE FUNCTION public.handle_public_booking(p_barbershop_id uuid, p_nome text, p_telefone text, p_service_id uuid, p_start_time timestamp with time zone, p_user_id uuid, p_email text DEFAULT NULL::text)
 RETURNS TABLE(client_id uuid, appointment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_owner_id uuid;
  v_client_id uuid;
  v_duration integer;
  v_end_time timestamptz;
  v_appt_id uuid;
BEGIN
  -- Validate barbershop
  SELECT b.owner_id
  INTO v_owner_id
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND COALESCE(b.is_active, true) = true;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'barbershop_not_found';
  END IF;

  -- Validate and normalize inputs
  v_phone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'invalid_start_time';
  END IF;

  -- Validate service belongs to this barbershop
  SELECT s.duration_minutes
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.barbershop_id = p_barbershop_id
    AND COALESCE(s.is_active, true) = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_service';
  END IF;

  v_duration := COALESCE(v_duration, 30);
  v_end_time := p_start_time + (v_duration::text || ' minutes')::interval;

  -- Validate professional belongs to barbershop (owner OR staff)
  IF NOT (
    public.user_belongs_to_barbershop(p_user_id, p_barbershop_id)
    OR p_user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'invalid_professional';
  END IF;

  -- Find existing client (exact normalized match OR last 9 digits match)
  SELECT c.client_id
  INTO v_client_id
  FROM public.clientes c
  WHERE c.barbershop_id = p_barbershop_id
    AND (
      regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') = v_phone
      OR right(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g'), 9) = right(v_phone, 9)
    )
  ORDER BY
    (regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g') = v_phone) DESC,
    c.updated_at DESC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clientes (
      barbershop_id,
      user_id,
      nome,
      telefone,
      email,
      last_visit,
      updated_at
    ) VALUES (
      p_barbershop_id,
      v_owner_id,
      btrim(p_nome),
      v_phone,
      NULLIF(btrim(p_email), ''),
      NOW(),
      NOW()
    )
    RETURNING clientes.client_id
    INTO v_client_id;
  ELSE
    UPDATE public.clientes
    SET nome = btrim(p_nome),
        telefone = v_phone,
        email = COALESCE(NULLIF(btrim(p_email), ''), clientes.email),
        last_visit = NOW(),
        updated_at = NOW()
    WHERE clientes.client_id = v_client_id;
  END IF;

  -- HARD BLOCK: prevent multiple active/future appointments per client
  -- Only block if status is pending or confirmed (cancelled appointments don't block)
  IF EXISTS (
    SELECT 1
    FROM public.agendamentos a
    WHERE a.barbershop_id = p_barbershop_id
      AND a.client_id = v_client_id
      AND a.status IN ('pending', 'confirmed')
      AND a.start_time >= now()
  ) THEN
    RAISE EXCEPTION 'existing_active_appointment';
  END IF;

  -- Create appointment linked to client
  INSERT INTO public.agendamentos (
    barbershop_id,
    user_id,
    client_id,
    nome_cliente,
    telefone_cliente,
    service_id,
    start_time,
    end_time,
    status
  ) VALUES (
    p_barbershop_id,
    p_user_id,
    v_client_id,
    btrim(p_nome),
    v_phone,
    p_service_id,
    p_start_time,
    v_end_time,
    'pending'
  )
  RETURNING agendamentos.id_agendamento
  INTO v_appt_id;

  -- Use qualified column names for output to avoid ambiguity
  handle_public_booking.client_id := v_client_id;
  handle_public_booking.appointment_id := v_appt_id;
  RETURN NEXT;
END;
$function$;