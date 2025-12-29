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
      console.error('[FB CAPI] Facebook credentials not configured');
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

    const payload = await req.json();
    const { 
      event_id, 
      role, 
      user_id,
      // Optional user data passed directly from client for better matching
      email: directEmail,
      phone: directPhone,
      name: directName,
    } = payload;

    console.log('[FB CAPI] Triggered with:', { event_id, role, user_id: user_id ? 'present' : 'null' });

    // event_id is REQUIRED for proper deduplication
    if (!event_id) {
      console.error('[FB CAPI] Missing event_id - required for deduplication');
      return new Response(
        JSON.stringify({ error: 'event_id is required for deduplication' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to get user data from database if user_id provided, otherwise use direct data
    let email = directEmail;
    let phone = directPhone;
    let name = directName;

    if (user_id && (!email || !phone)) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: userData, error: userError } = await supabase
          .from('user_settings')
          .select('nome, email, numero')
          .eq('user_id', user_id)
          .single();

        if (!userError && userData) {
          email = email || userData.email;
          phone = phone || userData.numero;
          name = name || userData.nome;
          console.log('[FB CAPI] User data fetched from DB');
        } else {
          console.log('[FB CAPI] Could not fetch user data from DB:', userError?.message);
        }
      } catch (dbError) {
        console.log('[FB CAPI] DB fetch error (non-blocking):', dbError);
      }
    }

    // Preparar hashes SHA-256 para correspondência avançada
    const hashedEmail = email ? await sha256Hash(email) : null;
    const hashedPhone = phone ? await sha256Hash(phone.replace(/\D/g, '')) : null;
    const hashedName = name ? await sha256Hash(name) : null;
    const hashedExternalId = user_id ? await sha256Hash(user_id) : null;

    // Montar payload para Facebook Conversions API
    const eventTime = Math.floor(Date.now() / 1000);
    
    const userData: Record<string, unknown> = {
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
    };

    if (hashedEmail) userData.em = [hashedEmail];
    if (hashedPhone) userData.ph = [hashedPhone];
    if (hashedName) userData.fn = [hashedName];
    if (hashedExternalId) userData.external_id = [hashedExternalId];

    const eventPayload = {
      data: [
        {
          event_name: 'CompleteRegistration',
          event_time: eventTime,
          action_source: 'website',
          event_id: event_id, // CRITICAL: same as eventID on browser for dedup
          user_data: userData,
          custom_data: {
            user_role: role || 'owner',
          },
        },
      ],
    };

    console.log('[FB CAPI] Sending event to Facebook:', JSON.stringify({
      event_id,
      event_name: 'CompleteRegistration',
      has_email: !!hashedEmail,
      has_phone: !!hashedPhone,
      has_name: !!hashedName,
      has_external_id: !!hashedExternalId,
    }));

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
      console.error('[FB CAPI] Facebook API error:', fbResult);
      return new Response(
        JSON.stringify({ error: 'Facebook API error', details: fbResult }),
        { status: fbResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[FB CAPI] CompleteRegistration sent successfully:', {
      event_id,
      events_received: fbResult.events_received,
    });

    return new Response(
      JSON.stringify({ success: true, event_id, facebook_response: fbResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[FB CAPI] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
