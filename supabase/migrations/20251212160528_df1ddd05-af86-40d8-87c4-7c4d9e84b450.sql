-- Primeiro limpar os órfãos
DELETE FROM subscriptions 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Adicionar foreign key com CASCADE DELETE para subscriptions
ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;