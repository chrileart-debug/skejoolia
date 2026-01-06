
-- =====================================================
-- PUBLIC ACCESS POLICIES FOR BOOKING PAGE
-- These policies allow unauthenticated users to view
-- data needed for the public booking page (/a/:slug)
-- =====================================================

-- 1. barbershops - Allow public to view active barbershops by slug
CREATE POLICY "Public can view active barbershops by slug"
ON public.barbershops
FOR SELECT
USING (is_active = true);

-- 2. services - Allow public to view active services of active barbershops
CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 3. categories - Allow public to view active categories
CREATE POLICY "Public can view active categories"
ON public.categories
FOR SELECT
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 4. user_barbershop_roles - Allow public to view active service providers
CREATE POLICY "Public can view active service providers"
ON public.user_barbershop_roles
FOR SELECT
USING (
  status = 'active' 
  AND is_service_provider = true
  AND EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 5. staff_services - Allow public to view staff services
CREATE POLICY "Public can view staff services"
ON public.staff_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 6. staff_schedules - Allow public to view staff schedules
CREATE POLICY "Public can view staff schedules"
ON public.staff_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 7. user_settings - Allow public to view names of service providers
CREATE POLICY "Public can view service provider names"
ON public.user_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_barbershop_roles r
    JOIN public.barbershops b ON b.id = r.barbershop_id
    WHERE r.user_id = user_settings.user_id
    AND r.is_service_provider = true
    AND r.status = 'active'
    AND b.is_active = true
  )
);

-- 8. agendamentos - Allow public to view appointments for availability checking
CREATE POLICY "Public can view appointments for availability"
ON public.agendamentos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
  AND status IN ('agendado', 'confirmado', 'bloqueado')
);

-- 9. barber_plans - Allow public to view published plans
CREATE POLICY "Public can view published plans"
ON public.barber_plans
FOR SELECT
USING (
  is_published = true 
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.barbershops b 
    WHERE b.id = barbershop_id AND b.is_active = true
  )
);

-- 10. barber_plan_items - Allow public to view items of published plans
CREATE POLICY "Public can view published plan items"
ON public.barber_plan_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.barber_plans p
    JOIN public.barbershops b ON b.id = p.barbershop_id
    WHERE p.id = plan_id 
    AND p.is_published = true 
    AND p.is_active = true
    AND b.is_active = true
  )
);
