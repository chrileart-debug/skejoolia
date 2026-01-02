-- Create tutorials table for help center
CREATE TABLE public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  category TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- Public read access (everyone can view tutorials)
CREATE POLICY "Anyone can view active tutorials"
ON public.tutorials
FOR SELECT
USING (is_active = true);

-- Only service role can manage tutorials (via Supabase Dashboard)
-- No insert/update/delete policies for regular users

-- Insert initial tutorial
INSERT INTO public.tutorials (title, description, video_url, display_order) VALUES
('Como criar seu agente?', 'Aprenda a configurar seu agente de atendimento automatizado para WhatsApp.', 'https://youtube.com/shorts/j6gNtVvxyRE', 1);