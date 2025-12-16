-- Create complementos table (global add-ons per user)
CREATE TABLE public.complementos (
  id_complemento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.complementos ENABLE ROW LEVEL SECURITY;

-- RLS policies for complementos
CREATE POLICY "Users can view own complementos" ON public.complementos
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own complementos" ON public.complementos
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own complementos" ON public.complementos
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own complementos" ON public.complementos
FOR DELETE USING (auth.uid() = user_id);

-- Create cortes_complementos junction table (many-to-many)
CREATE TABLE public.cortes_complementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_corte UUID NOT NULL REFERENCES public.cortes(id_corte) ON DELETE CASCADE,
  id_complemento UUID NOT NULL REFERENCES public.complementos(id_complemento) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(id_corte, id_complemento)
);

-- Enable RLS
ALTER TABLE public.cortes_complementos ENABLE ROW LEVEL SECURITY;

-- RLS policies for cortes_complementos (based on corte ownership)
CREATE POLICY "Users can view own cortes_complementos" ON public.cortes_complementos
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cortes WHERE id_corte = cortes_complementos.id_corte AND user_id = auth.uid())
);

CREATE POLICY "Users can insert own cortes_complementos" ON public.cortes_complementos
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.cortes WHERE id_corte = cortes_complementos.id_corte AND user_id = auth.uid())
);

CREATE POLICY "Users can delete own cortes_complementos" ON public.cortes_complementos
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.cortes WHERE id_corte = cortes_complementos.id_corte AND user_id = auth.uid())
);

-- Trigger for updated_at on complementos
CREATE TRIGGER update_complementos_updated_at
BEFORE UPDATE ON public.complementos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();