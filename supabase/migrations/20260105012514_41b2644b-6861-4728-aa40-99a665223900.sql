-- Fix existing staff members who should be service providers but aren't
UPDATE user_barbershop_roles
SET is_service_provider = true
WHERE role = 'staff' AND is_service_provider = false;