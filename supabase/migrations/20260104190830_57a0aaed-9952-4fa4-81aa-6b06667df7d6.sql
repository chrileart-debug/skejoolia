-- Add commission_percentage to user_barbershop_roles
ALTER TABLE user_barbershop_roles 
ADD COLUMN commission_percentage DECIMAL(5,2) DEFAULT NULL;

-- Create commissions table to track commission history
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  appointment_id UUID NOT NULL REFERENCES agendamentos(id_agendamento) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commissions
CREATE POLICY "Users can view barbershop commissions"
ON commissions FOR SELECT
USING (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Users can insert barbershop commissions"
ON commissions FOR INSERT
WITH CHECK (user_belongs_to_barbershop(auth.uid(), barbershop_id));

CREATE POLICY "Owners can update commissions"
ON commissions FOR UPDATE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

CREATE POLICY "Owners can delete commissions"
ON commissions FOR DELETE
USING (has_barbershop_role(auth.uid(), barbershop_id, 'owner'));

-- Create index for performance
CREATE INDEX idx_commissions_barbershop_user ON commissions(barbershop_id, user_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_created_at ON commissions(created_at);