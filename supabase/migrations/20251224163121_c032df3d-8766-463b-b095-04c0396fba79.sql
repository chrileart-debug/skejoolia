-- Habilitar extensão pg_net se não estiver habilitada (necessária para chamadas HTTP)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que chama a Edge Function quando um novo role é inserido
CREATE OR REPLACE FUNCTION public.trigger_fb_conversions_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Apenas dispara para novos registros
  IF TG_OP = 'INSERT' THEN
    -- Chamar a Edge Function de forma assíncrona via pg_net
    PERFORM net.http_post(
      url := 'https://xxdswrvqdzqtxbiamkqw.supabase.co/functions/v1/fb-conversions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id::text,
        'role', NEW.role::text
      )
    );
    
    RAISE LOG 'FB Conversions trigger fired for user_id: %, role: %', NEW.user_id, NEW.role;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block the INSERT
    RAISE LOG 'FB Conversions trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Criar o trigger na tabela user_barbershop_roles
DROP TRIGGER IF EXISTS on_user_registration_fb_conversions ON public.user_barbershop_roles;

CREATE TRIGGER on_user_registration_fb_conversions
  AFTER INSERT ON public.user_barbershop_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_fb_conversions_on_registration();

-- Comentário explicativo
COMMENT ON TRIGGER on_user_registration_fb_conversions ON public.user_barbershop_roles 
IS 'Dispara evento CompleteRegistration para Facebook Conversions API quando um novo usuário é registrado';