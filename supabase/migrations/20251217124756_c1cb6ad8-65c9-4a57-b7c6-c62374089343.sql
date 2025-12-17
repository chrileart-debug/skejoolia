-- Add permissions JSONB column to user_barbershop_roles
ALTER TABLE public.user_barbershop_roles 
ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;

-- Add a comment to document the permissions structure
COMMENT ON COLUMN public.user_barbershop_roles.permissions IS 'Granular permissions for staff: {can_view_dashboard, can_manage_agents, can_manage_schedule, can_view_clients}';

-- Update existing staff rows with default permissions (all true except dashboard)
UPDATE public.user_barbershop_roles 
SET permissions = jsonb_build_object(
  'can_view_dashboard', false,
  'can_manage_agents', false,
  'can_manage_schedule', true,
  'can_view_clients', true
)
WHERE role = 'staff';

-- Update existing owner rows with full permissions
UPDATE public.user_barbershop_roles 
SET permissions = jsonb_build_object(
  'can_view_dashboard', true,
  'can_manage_agents', true,
  'can_manage_schedule', true,
  'can_view_clients', true
)
WHERE role = 'owner';