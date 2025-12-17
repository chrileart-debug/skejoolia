-- Recreate the function with explicit type casts to fix column type mismatch
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
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security check: ensure the calling user is the owner of this barbershop
  IF NOT EXISTS (
    SELECT 1 FROM barbershops 
    WHERE id = p_barbershop_id 
    AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not the owner of this barbershop';
  END IF;

  RETURN QUERY
  SELECT 
    ubr.user_id,
    us.nome::text AS name,
    au.email::text AS email,
    us.numero::text AS phone,
    ubr.role::text AS role,
    ubr.permissions,
    CASE 
      WHEN au.confirmed_at IS NOT NULL THEN 'active'::text
      ELSE 'pending'::text
    END AS status,
    ubr.id AS role_id
  FROM user_barbershop_roles ubr
  LEFT JOIN user_settings us ON us.user_id = ubr.user_id
  LEFT JOIN auth.users au ON au.id = ubr.user_id
  WHERE ubr.barbershop_id = p_barbershop_id
  ORDER BY 
    CASE WHEN ubr.role = 'owner'::barbershop_role THEN 0 ELSE 1 END,
    us.nome;
END;
$$;