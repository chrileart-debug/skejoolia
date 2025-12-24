import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para criar hash SHA-256
async function sha256Hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN');
    const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID');
    
    if (!FB_ACCESS_TOKEN || !FB_PIXEL_ID) {
      console.error('Facebook credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Facebook credentials missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Capturar IP e User Agent dos headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    const clientUserAgent = req.headers.get('user-agent') || 'unknown';

    const { user_id, role, event_id } = await req.json();

    console.log('FB Conversions triggered for user_id:', user_id, 'role:', role, 'event_id:', event_id);

    if (!user_id || !role) {
      return new Response(
        JSON.stringify({ error: 'user_id and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar dados do usuário em user_settings
    const { data: userData, error: userError } = await supabase
      .from('user_settings')
      .select('nome, email, numero')
      .eq('user_id', user_id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return new Response(
        JSON.stringify({ error: 'User data not found', details: userError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User data found:', { nome: userData.nome, email: userData.email ? '***' : null });

    // Preparar hashes SHA-256 para correspondência avançada
    const hashedEmail = userData.email ? await sha256Hash(userData.email) : null;
    const hashedPhone = userData.numero ? await sha256Hash(userData.numero.replace(/\D/g, '')) : null;
    const hashedName = userData.nome ? await sha256Hash(userData.nome) : null;

    // Montar payload para Facebook Conversions API
    const eventTime = Math.floor(Date.now() / 1000);
    
    const eventPayload = {
      data: [
        {
          event_name: 'CompleteRegistration',
          event_time: eventTime,
          action_source: 'website',
          // event_id para deduplicação com o evento client-side
          ...(event_id && { event_id: event_id }),
          user_data: {
            ...(hashedEmail && { em: [hashedEmail] }),
            ...(hashedPhone && { ph: [hashedPhone] }),
            ...(hashedName && { fn: [hashedName] }),
            client_ip_address: clientIp,
            client_user_agent: clientUserAgent,
          },
          custom_data: {
            user_role: role, // 'owner' ou 'staff'
          },
        },
      ],
    };

    console.log('Sending event to Facebook CAPI:', JSON.stringify(eventPayload, null, 2));

    // Enviar para Facebook Conversions API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      }
    );

    const fbResult = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error('Facebook API error:', fbResult);
      return new Response(
        JSON.stringify({ error: 'Facebook API error', details: fbResult }),
        { status: fbResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Facebook CompleteRegistration event sent successfully:', fbResult);

    return new Response(
      JSON.stringify({ success: true, facebook_response: fbResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fb-conversions function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
