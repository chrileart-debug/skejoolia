-- Add user_id column to memoria table for ownership tracking
ALTER TABLE public.memoria ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.memoria ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for memoria table
CREATE POLICY "Users can view own chat memory"
ON public.memoria
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat memory"
ON public.memoria
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat memory"
ON public.memoria
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat memory"
ON public.memoria
FOR DELETE
USING (auth.uid() = user_id);

-- Allow service_role full access for N8N/webhook integrations
-- (service_role bypasses RLS by default, but explicit policy for clarity)
COMMENT ON TABLE public.memoria IS 'Chat memory storage with RLS. Service role has full access for N8N integrations.';