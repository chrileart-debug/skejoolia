-- Remover a política atual de SELECT que permite ver todos os agendamentos
DROP POLICY IF EXISTS "Users can view barbershop appointments" ON public.agendamentos;

-- Criar nova política: Owners veem tudo, Staff vê apenas os próprios agendamentos
CREATE POLICY "Users can view their appointments" 
ON public.agendamentos 
FOR SELECT 
USING (
  -- Owner pode ver todos os agendamentos da barbearia
  has_barbershop_role(auth.uid(), barbershop_id, 'owner'::barbershop_role)
  OR
  -- Staff só pode ver agendamentos onde ele é o profissional
  (user_id = auth.uid() AND user_belongs_to_barbershop(auth.uid(), barbershop_id))
);