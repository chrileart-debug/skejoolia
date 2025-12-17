-- 1. Add business columns to barbershops table
ALTER TABLE public.barbershops
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS nicho TEXT,
ADD COLUMN IF NOT EXISTS subnicho TEXT,
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT;

-- 2. Migrate existing data from user_settings to barbershops
UPDATE public.barbershops b
SET 
  cpf_cnpj = COALESCE(us.cpf_cnpj, us.cnpj),
  nicho = us.nicho,
  subnicho = us.subnicho,
  asaas_customer_id = us.asaas_customer_id,
  cep = us.cep,
  address = COALESCE(b.address, us.endereco),
  city = COALESCE(b.city, us.cidade),
  state = COALESCE(b.state, us.estado),
  name = COALESCE(NULLIF(b.name, ''), us.nome_empresa, b.name)
FROM public.user_settings us
WHERE b.owner_id = us.user_id;

-- 3. Drop business columns from user_settings
ALTER TABLE public.user_settings
DROP COLUMN IF EXISTS nome_empresa,
DROP COLUMN IF EXISTS cnpj,
DROP COLUMN IF EXISTS cpf_cnpj,
DROP COLUMN IF EXISTS cep,
DROP COLUMN IF EXISTS endereco,
DROP COLUMN IF EXISTS cidade,
DROP COLUMN IF EXISTS estado,
DROP COLUMN IF EXISTS nicho,
DROP COLUMN IF EXISTS subnicho,
DROP COLUMN IF EXISTS asaas_customer_id;