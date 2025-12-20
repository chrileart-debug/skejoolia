-- Add banking data columns to barbershops table for Asaas Transfer Integration
ALTER TABLE public.barbershops
ADD COLUMN IF NOT EXISTS bank_operation_type text DEFAULT 'PIX',
ADD COLUMN IF NOT EXISTS bank_pix_key_type text,
ADD COLUMN IF NOT EXISTS bank_pix_key text,
ADD COLUMN IF NOT EXISTS bank_code text,
ADD COLUMN IF NOT EXISTS bank_branch text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_account_digit text,
ADD COLUMN IF NOT EXISTS bank_owner_birth_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.barbershops.bank_operation_type IS 'PIX or TED';
COMMENT ON COLUMN public.barbershops.bank_pix_key_type IS 'CPF, CNPJ, EMAIL, PHONE, EVP';
COMMENT ON COLUMN public.barbershops.bank_pix_key IS 'Pix key value';
COMMENT ON COLUMN public.barbershops.bank_code IS 'Bank code for TED';
COMMENT ON COLUMN public.barbershops.bank_branch IS 'Branch number for TED';
COMMENT ON COLUMN public.barbershops.bank_account_number IS 'Account number for TED';
COMMENT ON COLUMN public.barbershops.bank_account_digit IS 'Account digit for TED';
COMMENT ON COLUMN public.barbershops.bank_owner_birth_date IS 'Owner birth date - mandatory if CPF';