-- Fix ambiguous RPC: drop the text version and update uuid version to allow members (not just owner)

-- Step 1: Drop the text version that's causing ambiguity
DROP FUNCTION IF EXISTS public.get_barbershop_team(text);

-- Step 2: Replace the uuid version with member-based access (owner OR staff can view)
CREATE OR REPLACE FUNCTION public.get_barbershop_team(p_barbershop_id uuid)
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  phone text,
  role text,
  permissions jsonb,
  status text,
  role_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated and a member of the barbershop (owner OR staff)
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
    ubr.user_id,
    us.nome AS name,
    COALESCE(us.email, au.email) AS email,
    us.numero AS phone,
    ubr.role::text AS role,
    COALESCE(ubr.permissions, '{}'::jsonb) AS permissions,
    ubr.status,
    ubr.id AS role_id
  FROM public.user_barbershop_roles ubr
  LEFT JOIN public.user_settings us ON us.user_id = ubr.user_id
  LEFT JOIN auth.users au ON au.id = ubr.user_id
  WHERE ubr.barbershop_id = p_barbershop_id
  ORDER BY
    CASE WHEN ubr.role = 'owner'::barbershop_role THEN 0 ELSE 1 END,
    us.nome NULLS LAST;
END;
$$;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_barbershop_team(uuid) TO authenticated;