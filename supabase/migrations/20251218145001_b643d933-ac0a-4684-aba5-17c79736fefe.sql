-- Robust public client lookup + hard duplicate blocking + public reschedule/cancel helpers

-- 1) Find client by phone (normalizes both input and stored telefone)
CREATE OR REPLACE FUNCTION public.find_client_by_phone(
  p_barbershop_id uuid,
  p_phone text
)
RETURNS TABLE (
  client_id uuid,
  nome text,
  telefone text,
  email text,
  total_cortes integer,
  faturamento_total numeric,
  last_visit timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.client_id,
    c.nome,
    c.telefone,
    c.email,
    c.total_cortes,
    c.faturamento_total,
    c.last_visit
  FROM public.clientes c
  WHERE c.barbershop_id = p_barbershop_id
    AND (
      regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') = v_phone
      OR right(regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g'), 9) = right(v_phone, 9)
    )
  ORDER BY
    (regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') = v_phone) DESC,
    c.updated_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_client_by_phone(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_client_by_phone(uuid, text) TO authenticated;


-- 2) Get active/future appointment (pending/confirmed) for a client, gated by phone match
CREATE OR REPLACE FUNCTION public.get_active_appointment_for_client_phone(
  p_barbershop_id uuid,
  p_client_id uuid,
  p_phone text
)
RETURNS TABLE (
  id_agendamento uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  nome_cliente text,
  service_id uuid,
  user_id uuid,
  service_name text,
  professional_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_phone text;
  v_client_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RETURN;
  END IF;

  SELECT right(regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g'), 9)
  INTO v_client_phone
  FROM public.clientes c
  WHERE c.client_id = p_client_id
    AND c.barbershop_id = p_barbershop_id
  LIMIT 1;

  IF v_client_phone IS NULL OR v_client_phone <> right(v_phone, 9) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id_agendamento,
    a.start_time,
    a.end_time,
    a.status,
    a.nome_cliente,
    a.service_id,
    a.user_id,
    s.name AS service_name,
    us.nome AS professional_name
  FROM public.agendamentos a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.user_settings us ON us.user_id = a.user_id
  WHERE a.barbershop_id = p_barbershop_id
    AND a.client_id = p_client_id
    AND a.status IN ('pending', 'confirmed')
    AND a.start_time >= now()
  ORDER BY a.start_time ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_appointment_for_client_phone(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_appointment_for_client_phone(uuid, uuid, text) TO authenticated;


-- 3) Cancel appointment (only if phone matches appointment.telefone_cliente)
CREATE OR REPLACE FUNCTION public.cancel_public_appointment(
  p_barbershop_id uuid,
  p_appointment_id uuid,
  p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_phone text;
  v_db_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RETURN false;
  END IF;

  SELECT right(regexp_replace(COALESCE(a.telefone_cliente, ''), '\\D', '', 'g'), 9)
  INTO v_db_phone
  FROM public.agendamentos a
  WHERE a.id_agendamento = p_appointment_id
    AND a.barbershop_id = p_barbershop_id
  LIMIT 1;

  IF v_db_phone IS NULL OR v_db_phone <> right(v_phone, 9) THEN
    RETURN false;
  END IF;

  UPDATE public.agendamentos
  SET status = 'cancelled',
      updated_at = now()
  WHERE id_agendamento = p_appointment_id
    AND barbershop_id = p_barbershop_id
    AND status IN ('pending', 'confirmed')
    AND start_time >= now();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_public_appointment(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_public_appointment(uuid, uuid, text) TO authenticated;


-- 4) Reschedule appointment (only if phone matches appointment.telefone_cliente)
CREATE OR REPLACE FUNCTION public.reschedule_public_appointment(
  p_barbershop_id uuid,
  p_appointment_id uuid,
  p_phone text,
  p_service_id uuid,
  p_user_id uuid,
  p_start_time timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_phone text;
  v_db_phone text;
  v_owner_id uuid;
  v_duration integer;
  v_end_time timestamptz;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  -- Ensure appointment belongs to barbershop and phone matches
  SELECT right(regexp_replace(COALESCE(a.telefone_cliente, ''), '\\D', '', 'g'), 9)
  INTO v_db_phone
  FROM public.agendamentos a
  WHERE a.id_agendamento = p_appointment_id
    AND a.barbershop_id = p_barbershop_id
  LIMIT 1;

  IF v_db_phone IS NULL OR v_db_phone <> right(v_phone, 9) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  -- Validate barbershop
  SELECT b.owner_id
  INTO v_owner_id
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND COALESCE(b.is_active, true) = true;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'barbershop_not_found';
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

  UPDATE public.agendamentos
  SET start_time = p_start_time,
      end_time = v_end_time,
      service_id = p_service_id,
      user_id = p_user_id,
      status = 'pending',
      updated_at = now()
  WHERE id_agendamento = p_appointment_id
    AND barbershop_id = p_barbershop_id
    AND status IN ('pending', 'confirmed')
    AND start_time >= now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found_or_not_allowed';
  END IF;

  RETURN p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_public_appointment(uuid, uuid, text, uuid, uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.reschedule_public_appointment(uuid, uuid, text, uuid, uuid, timestamptz) TO authenticated;


-- 5) Update handle_public_booking to:
--    - match existing client by normalized phone OR last 9 digits
--    - standardize telefone to digits
--    - HARD BLOCK: only one active/future pending/confirmed appointment per client per barbershop
CREATE OR REPLACE FUNCTION public.handle_public_booking(
  p_barbershop_id uuid,
  p_nome text,
  p_telefone text,
  p_service_id uuid,
  p_start_time timestamptz,
  p_user_id uuid,
  p_email text DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  appointment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
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
  v_phone := regexp_replace(COALESCE(p_telefone, ''), '\\D', '', 'g');
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
      regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') = v_phone
      OR right(regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g'), 9) = right(v_phone, 9)
    )
  ORDER BY
    (regexp_replace(COALESCE(c.telefone, ''), '\\D', '', 'g') = v_phone) DESC,
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
    RETURNING public.clientes.client_id
    INTO v_client_id;
  ELSE
    UPDATE public.clientes
    SET nome = btrim(p_nome),
        telefone = v_phone,
        email = COALESCE(NULLIF(btrim(p_email), ''), public.clientes.email),
        last_visit = NOW(),
        updated_at = NOW()
    WHERE client_id = v_client_id;
  END IF;

  -- HARD BLOCK: prevent multiple active/future appointments per client
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
  RETURNING public.agendamentos.id_agendamento
  INTO v_appt_id;

  client_id := v_client_id;
  appointment_id := v_appt_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_public_booking(uuid, text, text, uuid, timestamptz, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_public_booking(uuid, text, text, uuid, timestamptz, uuid, text) TO authenticated;
