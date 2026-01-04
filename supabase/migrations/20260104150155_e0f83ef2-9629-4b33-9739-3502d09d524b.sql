-- Create helper function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id uuid,
  _barbershop_id uuid,
  _permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_barbershop_roles
    WHERE user_id = _user_id
      AND barbershop_id = _barbershop_id
      AND (permissions->>_permission_key)::boolean = true
  )
$$;

-- Drop existing restrictive policies on services
DROP POLICY IF EXISTS "Users can insert their own services" ON public.services;
DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;

-- Create new policies for services that allow staff with permission
CREATE POLICY "Owners and staff with permission can insert services"
ON public.services FOR INSERT
WITH CHECK (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);

CREATE POLICY "Owners and staff with permission can update services"
ON public.services FOR UPDATE
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);

CREATE POLICY "Owners and staff with permission can delete services"
ON public.services FOR DELETE
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);

-- Drop existing restrictive policies on staff_services
DROP POLICY IF EXISTS "Users can manage staff services for their barbershop" ON public.staff_services;

-- Staff can manage their own staff_services
CREATE POLICY "Staff can manage own staff_services"
ON public.staff_services FOR ALL
USING (
  user_id = auth.uid() 
  AND public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
)
WITH CHECK (
  user_id = auth.uid() 
  AND public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
);

-- Owners can manage all staff_services in their barbershop
CREATE POLICY "Owners can manage all staff_services"
ON public.staff_services FOR ALL
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
)
WITH CHECK (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
);

-- Drop existing restrictive policies on staff_schedules
DROP POLICY IF EXISTS "Users can manage staff schedules for their barbershop" ON public.staff_schedules;

-- Staff can manage their own staff_schedules
CREATE POLICY "Staff can manage own staff_schedules"
ON public.staff_schedules FOR ALL
USING (
  user_id = auth.uid() 
  AND public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
)
WITH CHECK (
  user_id = auth.uid() 
  AND public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
);

-- Owners can manage all staff_schedules in their barbershop
CREATE POLICY "Owners can manage all staff_schedules"
ON public.staff_schedules FOR ALL
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
)
WITH CHECK (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
);

-- Drop existing restrictive policies on categories if they exist
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

-- Create new policies for categories that allow staff with permission
CREATE POLICY "Owners and staff with permission can insert categories"
ON public.categories FOR INSERT
WITH CHECK (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);

CREATE POLICY "Owners and staff with permission can update categories"
ON public.categories FOR UPDATE
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);

CREATE POLICY "Owners and staff with permission can delete categories"
ON public.categories FOR DELETE
USING (
  public.has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR (
    public.user_belongs_to_barbershop(auth.uid(), barbershop_id)
    AND public.user_has_permission(auth.uid(), barbershop_id, 'can_manage_services')
  )
);