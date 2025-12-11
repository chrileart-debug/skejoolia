-- Create user_settings for existing users that don't have one
INSERT INTO user_settings (user_id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM user_settings us WHERE us.user_id = u.id);