-- Enable RLS on barber_plans
ALTER TABLE public.barber_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for barber_plans
CREATE POLICY "Users can view barbershop plans"
ON public.barber_plans FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can insert plans"
ON public.barber_plans FOR INSERT
WITH CHECK (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can update plans"
ON public.barber_plans FOR UPDATE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can delete plans"
ON public.barber_plans FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- Enable RLS on barber_plan_items
ALTER TABLE public.barber_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for barber_plan_items (via plan ownership)
CREATE POLICY "Users can view plan items"
ON public.barber_plan_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM barber_plans p
  WHERE p.id = barber_plan_items.plan_id
  AND user_belongs_to_barbershop(auth.uid(), p.barbershop_id)
));

CREATE POLICY "Owners can insert plan items"
ON public.barber_plan_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM barber_plans p
  WHERE p.id = barber_plan_items.plan_id
  AND has_barbershop_role(auth.uid(), p.barbershop_id, 'owner')
));

CREATE POLICY "Owners can update plan items"
ON public.barber_plan_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM barber_plans p
  WHERE p.id = barber_plan_items.plan_id
  AND has_barbershop_role(auth.uid(), p.barbershop_id, 'owner')
));

CREATE POLICY "Owners can delete plan items"
ON public.barber_plan_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM barber_plans p
  WHERE p.id = barber_plan_items.plan_id
  AND has_barbershop_role(auth.uid(), p.barbershop_id, 'owner')
));

-- Enable RLS on client_club_subscriptions
ALTER TABLE public.client_club_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_club_subscriptions
CREATE POLICY "Users can view barbershop client subscriptions"
ON public.client_club_subscriptions FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert client subscriptions"
ON public.client_club_subscriptions FOR INSERT
WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can update client subscriptions"
ON public.client_club_subscriptions FOR UPDATE
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can delete client subscriptions"
ON public.client_club_subscriptions FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- Enable RLS on client_subscription_usage
ALTER TABLE public.client_subscription_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_subscription_usage (via subscription ownership)
CREATE POLICY "Users can view subscription usage"
ON public.client_subscription_usage FOR SELECT
USING (EXISTS (
  SELECT 1 FROM client_club_subscriptions s
  WHERE s.id = client_subscription_usage.subscription_id
  AND user_belongs_to_barbershop(auth.uid(), s.barbershop_id)
));

CREATE POLICY "Users can insert subscription usage"
ON public.client_subscription_usage FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM client_club_subscriptions s
  WHERE s.id = client_subscription_usage.subscription_id
  AND user_belongs_to_barbershop(auth.uid(), s.barbershop_id)
));

CREATE POLICY "Users can delete subscription usage"
ON public.client_subscription_usage FOR DELETE
USING (EXISTS (
  SELECT 1 FROM client_club_subscriptions s
  WHERE s.id = client_subscription_usage.subscription_id
  AND user_belongs_to_barbershop(auth.uid(), s.barbershop_id)
));