import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { email, name, phone, barbershop_id } = await req.json();

    if (!email || !barbershop_id || !name) {
      return new Response(
        JSON.stringify({ error: 'Email, name, and barbershop_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invite request:', { email, name, phone, barbershop_id, invited_by: user.id });

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an owner of the barbershop
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_barbershop_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('barbershop_id', barbershop_id)
      .single();

    if (roleError || !roleData || roleData.role !== 'owner') {
      console.error('Permission denied - not owner:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only owners can invite team members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get barbershop name for the invite email
    const { data: barbershop, error: shopError } = await supabaseAdmin
      .from('barbershops')
      .select('name')
      .eq('id', barbershop_id)
      .single();

    if (shopError || !barbershop) {
      console.error('Barbershop not found:', shopError);
      return new Response(
        JSON.stringify({ error: 'Barbershop not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // Check if user is already a member of this barbershop
      const { data: existingRole } = await supabaseAdmin
        .from('user_barbershop_roles')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('barbershop_id', barbershop_id)
        .single();

      if (existingRole) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this barbershop' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add existing user to barbershop as staff
      const { error: insertError } = await supabaseAdmin
        .from('user_barbershop_roles')
        .insert({
          user_id: existingUser.id,
          barbershop_id: barbershop_id,
          role: 'staff'
        });

      if (insertError) {
        console.error('Error adding existing user to barbershop:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to add user to team' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Existing user added to barbershop as staff');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User added to team',
          existing_user: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invite new user via Supabase Auth
    const redirectUrl = `${req.headers.get('origin') || 'https://skejool.lovable.app'}/dashboard`;
    
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectUrl,
        data: {
          nome: name,
          numero: phone,
          barbershop_id: barbershop_id,
          role: 'staff',
          invited_by: user.id
        }
      }
    );

    if (inviteError) {
      console.error('Error sending invite:', inviteError);
      return new Response(
        JSON.stringify({ error: inviteError.message || 'Failed to send invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invite sent successfully:', inviteData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invite sent to ${email}`,
        user_id: inviteData.user?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in invite-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
