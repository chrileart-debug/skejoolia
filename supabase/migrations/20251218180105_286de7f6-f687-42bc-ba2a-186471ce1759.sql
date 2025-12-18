ALTER TABLE barbershops 
ADD COLUMN bairro text,
ADD COLUMN address_number text,
ADD COLUMN asaas_wallet_id text,
ADD COLUMN asaas_api_key text,
ADD COLUMN income_value numeric DEFAULT 5000.00;