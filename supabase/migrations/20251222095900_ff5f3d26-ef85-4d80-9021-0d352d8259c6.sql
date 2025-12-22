-- Fix RLS for client_transactions so app can record manual subscription payments

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.client_transactions ENABLE ROW LEVEL SECURITY;

-- Insert policy: allow barbershop members to record transactions for their barbershop
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'client_transactions'
      AND policyname = 'Users can insert barbershop client transactions'
  ) THEN
    CREATE POLICY "Users can insert barbershop client transactions"
    ON public.client_transactions
    FOR INSERT
    WITH CHECK (
      barbershop_id IS NOT NULL
      AND user_belongs_to_barbershop(auth.uid(), barbershop_id)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'client_transactions'
      AND policyname = 'Users can view barbershop client transactions'
  ) THEN
    CREATE POLICY "Users can view barbershop client transactions"
    ON public.client_transactions
    FOR SELECT
    USING (
      barbershop_id IS NOT NULL
      AND user_belongs_to_barbershop(auth.uid(), barbershop_id)
    );
  END IF;
END $$;