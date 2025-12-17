-- Upsert Básico and Corporativo plans
INSERT INTO public.plans (slug, name, price, trial_days, max_agents, max_whatsapp, max_services, max_appointments_month, is_active)
VALUES 
  ('basico', 'Básico', 29.90, 7, 1, 1, 3, 10, true),
  ('corporativo', 'Corporativo', 49.90, 7, 5, 5, 9999, 9999, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  trial_days = EXCLUDED.trial_days,
  max_agents = EXCLUDED.max_agents,
  max_whatsapp = EXCLUDED.max_whatsapp,
  max_services = EXCLUDED.max_services,
  max_appointments_month = EXCLUDED.max_appointments_month,
  is_active = EXCLUDED.is_active;