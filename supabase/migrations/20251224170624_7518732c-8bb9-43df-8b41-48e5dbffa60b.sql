-- Atualizar função do trigger para capturar fb_event_id do metadata do usuário
CREATE OR REPLACE FUNCTION public.trigger_fb_conversions_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_metadata jsonb;
  v_fb_event_id text;
BEGIN
  -- Apenas dispara para novos registros
  IF TG_OP = 'INSERT' THEN
    -- Buscar metadata do usuário para obter fb_event_id
    SELECT raw_user_meta_data INTO v_user_metadata
    FROM auth.users
    WHERE id = NEW.user_id;
    
    v_fb_event_id := v_user_metadata->>'fb_event_id';
    
    -- Chamar a Edge Function de forma assíncrona via pg_net
    PERFORM net.http_post(
      url := 'https://xxdswrvqdzqtxbiamkqw.supabase.co/functions/v1/fb-conversions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id::text,
        'role', NEW.role::text,
        'event_id', COALESCE(v_fb_event_id, '')
      )
    );
    
    RAISE LOG 'FB Conversions trigger fired for user_id: %, role: %, event_id: %', NEW.user_id, NEW.role, v_fb_event_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block the INSERT
    RAISE LOG 'FB Conversions trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Comentário explicativo atualizado
COMMENT ON FUNCTION public.trigger_fb_conversions_on_registration() 
IS 'Dispara evento CompleteRegistration para Facebook Conversions API com event_id para deduplicação híbrida';