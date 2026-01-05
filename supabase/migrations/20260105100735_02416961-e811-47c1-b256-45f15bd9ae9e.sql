-- Create a scheduled function to expire trials automatically
-- This runs every hour to check for expired trials

-- First, ensure we have a function that can be called by a cron job
CREATE OR REPLACE FUNCTION public.auto_expire_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE subscriptions
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    status = 'trialing'
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < NOW();
END;
$$;

-- Create an index to speed up the trial expiration check
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_expires 
ON subscriptions (trial_expires_at) 
WHERE status = 'trialing';

-- Create a table to log session activity (entry/exit times)
CREATE TABLE IF NOT EXISTS public.user_session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on session logs
ALTER TABLE public.user_session_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own session logs
CREATE POLICY "Users can view their own session logs"
ON public.user_session_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own session logs
CREATE POLICY "Users can insert their own session logs"
ON public.user_session_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own session logs
CREATE POLICY "Users can update their own session logs"
ON public.user_session_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_session_logs_user_id ON public.user_session_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_session_logs_barbershop_id ON public.user_session_logs (barbershop_id);

-- Function to start a session
CREATE OR REPLACE FUNCTION public.start_user_session(p_barbershop_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO user_session_logs (user_id, barbershop_id, session_start)
  VALUES (auth.uid(), p_barbershop_id, NOW())
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- Function to end a session
CREATE OR REPLACE FUNCTION public.end_user_session(p_session_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_session_logs
  SET session_end = NOW()
  WHERE id = p_session_id
    AND user_id = auth.uid()
    AND session_end IS NULL;
  
  RETURN FOUND;
END;
$$;