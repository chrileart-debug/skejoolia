-- Fix specific employee: studiopurpleoficial@gmail.com
-- Set is_service_provider = true
UPDATE user_barbershop_roles 
SET is_service_provider = true 
WHERE user_id = '8c9d8322-aad3-45ef-8902-a442594aa155'
  AND role = 'staff';

-- Create default staff schedules for this employee (if not exists)
INSERT INTO staff_schedules (user_id, barbershop_id, day_of_week, start_time, end_time, is_working)
SELECT 
  '8c9d8322-aad3-45ef-8902-a442594aa155',
  '41924121-2c7d-4706-ab2f-a78ead38cc70',
  day_num,
  '08:00',
  '18:00',
  CASE WHEN day_num BETWEEN 1 AND 5 THEN true ELSE false END
FROM generate_series(0, 6) AS day_num
WHERE NOT EXISTS (
  SELECT 1 FROM staff_schedules 
  WHERE user_id = '8c9d8322-aad3-45ef-8902-a442594aa155'
    AND barbershop_id = '41924121-2c7d-4706-ab2f-a78ead38cc70'
);

-- Fix ALL existing active staff members with is_service_provider = false or null
UPDATE user_barbershop_roles
SET is_service_provider = true
WHERE role = 'staff' 
  AND status = 'active'
  AND (is_service_provider = false OR is_service_provider IS NULL);

-- Set default value for new staff records
ALTER TABLE user_barbershop_roles 
ALTER COLUMN is_service_provider SET DEFAULT true;