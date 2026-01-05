-- Allow both owner and staff (members) to fetch team list securely
-- Replaces previous owner-only implementation that raised: "Access denied: You are not the owner of this barbershop"

CREATE OR REPLACE FUNCTION public.get_barbershop_team(p_barbershop_id text)
RETURNS TABLE(
  email text,
  name text,
  permissions jsonb,
  phone text,
  role text,
  role_id text,
  status text,
  user_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated and a member of the barbershop
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_barbershop_roles ubr
    WHERE ubr.barbershop_id = p_barbershop_id
      AND ubr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not belong to this barbershop'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    us.email,
    us.nome AS name,
    COALESCE(ubr.permissions, '{}'::jsonb) AS permissions,
    us.numero AS phone,
    ubr.role::text AS role,
    ubr.id::text AS role_id,
    ubr.status,
    ubr.user_id::text AS user_id
  FROM public.user_barbershop_roles ubr
  LEFT JOIN public.user_settings us
    ON us.user_id = ubr.user_id
  WHERE ubr.barbershop_id = p_barbershop_id
  ORDER BY
    CASE WHEN ubr.role = 'owner' THEN 0 ELSE 1 END,
    us.nome NULLS LAST;
END;
$$;

-- Ensure authenticated users can execute
GRANT EXECUTE ON FUNCTION public.get_barbershop_team(text) TO authenticated;