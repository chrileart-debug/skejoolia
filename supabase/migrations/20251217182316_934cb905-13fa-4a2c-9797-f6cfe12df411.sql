-- Create RPC for public booking: upsert client + create appointment

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

  -- Upsert client (client belongs to barbershop; store owner_id on user_id for consistent listing)
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
  ON CONFLICT (barbershop_id, telefone)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    email = COALESCE(EXCLUDED.email, public.clientes.email),
    last_visit = EXCLUDED.last_visit,
    updated_at = NOW()
  RETURNING public.clientes.client_id
  INTO v_client_id;

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

-- Allow calling from client (anon/public booking + authenticated)
GRANT EXECUTE ON FUNCTION public.handle_public_booking(uuid, text, text, uuid, timestamptz, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_public_booking(uuid, text, text, uuid, timestamptz, uuid, text) TO authenticated;
