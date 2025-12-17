-- Allow barbershop owners to view team members' user_settings (PII) safely

-- Helper function: does current auth user own a barbershop that the target user belongs to?
CREATE OR REPLACE FUNCTION public.owner_can_view_user_settings(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_barbershop_roles ubr
    JOIN public.barbershops b ON b.id = ubr.barbershop_id
    WHERE ubr.user_id = _target_user_id
      AND b.owner_id = auth.uid()
  );
$$;

-- user_settings: keep existing self-access, add owner read access for their team
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Owners can view team settings'
  ) THEN
    CREATE POLICY "Owners can view team settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING (public.owner_can_view_user_settings(user_id));
  END IF;
END$$;
