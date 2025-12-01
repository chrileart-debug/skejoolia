-- =============================================
-- FUNÇÃO PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TABELA: user_settings
-- =============================================
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  numero TEXT,
  email TEXT,
  nome_empresa TEXT,
  cnpj TEXT,
  cep TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  nicho TEXT,
  subnicho TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: integracao_whatsapp
-- =============================================
CREATE TABLE public.integracao_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  numero TEXT NOT NULL,
  email TEXT,
  instancia TEXT,
  status TEXT DEFAULT 'offline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_integracao_whatsapp_user_id ON public.integracao_whatsapp(user_id);

ALTER TABLE public.integracao_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON public.integracao_whatsapp FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.integracao_whatsapp FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.integracao_whatsapp FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON public.integracao_whatsapp FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_integracao_whatsapp_updated_at
  BEFORE UPDATE ON public.integracao_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: agentes
-- =============================================
CREATE TABLE public.agentes (
  id_agente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  funcao TEXT,
  sexo TEXT,
  tom_de_voz TEXT,
  objetivo TEXT,
  limite_caracteres INTEGER,
  restricoes TEXT,
  horario_trabalho JSONB,
  whatsapp_id UUID REFERENCES public.integracao_whatsapp(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_agentes_user_id ON public.agentes(user_id);
CREATE INDEX idx_agentes_whatsapp_id ON public.agentes(whatsapp_id);

ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agents"
  ON public.agentes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents"
  ON public.agentes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
  ON public.agentes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
  ON public.agentes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_agentes_updated_at
  BEFORE UPDATE ON public.agentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: cortes
-- =============================================
CREATE TABLE public.cortes (
  id_corte UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_corte TEXT,
  nome_corte TEXT NOT NULL,
  descricao TEXT,
  preco_corte NUMERIC(10, 2) NOT NULL DEFAULT 0,
  agente_pode_usar BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_cortes_user_id ON public.cortes(user_id);

ALTER TABLE public.cortes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own services"
  ON public.cortes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own services"
  ON public.cortes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own services"
  ON public.cortes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own services"
  ON public.cortes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_cortes_updated_at
  BEFORE UPDATE ON public.cortes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: clientes
-- =============================================
CREATE TABLE public.clientes (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  id_agente UUID REFERENCES public.agentes(id_agente) ON DELETE SET NULL,
  total_cortes INTEGER DEFAULT 0,
  faturamento_total NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX idx_clientes_id_agente ON public.clientes(id_agente);
CREATE INDEX idx_clientes_telefone ON public.clientes(telefone);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON public.clientes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: agendamentos
-- =============================================
CREATE TABLE public.agendamentos (
  id_agendamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_corte UUID REFERENCES public.cortes(id_corte) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clientes(client_id) ON DELETE SET NULL,
  dia_do_corte DATE NOT NULL,
  horario_corte TIME NOT NULL,
  nome_cliente TEXT,
  telefone_cliente TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_agendamentos_user_id ON public.agendamentos(user_id);
CREATE INDEX idx_agendamentos_id_corte ON public.agendamentos(id_corte);
CREATE INDEX idx_agendamentos_client_id ON public.agendamentos(client_id);
CREATE INDEX idx_agendamentos_dia_do_corte ON public.agendamentos(dia_do_corte);
CREATE INDEX idx_agendamentos_status ON public.agendamentos(status);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments"
  ON public.agendamentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own appointments"
  ON public.agendamentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own appointments"
  ON public.agendamentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own appointments"
  ON public.agendamentos FOR DELETE
  USING (auth.uid() = user_id);