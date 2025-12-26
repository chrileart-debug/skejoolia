import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Permissions {
  can_view_dashboard: boolean;
  can_manage_agents: boolean;
  can_manage_schedule: boolean;
  can_view_clients: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  can_view_dashboard: false,
  can_manage_agents: false,
  can_manage_schedule: true,
  can_view_clients: true,
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

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the caller using the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { email, name, phone, barbershop_id, permissions, resend } = await req.json();

    if (!email || !barbershop_id) {
      return new Response(
        JSON.stringify({ error: 'Email and barbershop_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided permissions or defaults
    const memberPermissions: Permissions = permissions || DEFAULT_PERMISSIONS;
    const origin = req.headers.get('origin') || 'https://skejool.lovable.app';

    console.log('Invite request:', { email, name, phone, barbershop_id, permissions: memberPermissions, invited_by: user.id, resend });

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

    // Check if user already exists in auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw new Error('Failed to check existing users');
    }

    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // SCENARIO A: User Already Exists
    if (existingUser) {
      console.log('User already exists:', existingUser.id);

      // Check if user is already a member of this barbershop
      const { data: existingRole } = await supabaseAdmin
        .from('user_barbershop_roles')
        .select('id, status')
        .eq('user_id', existingUser.id)
        .eq('barbershop_id', barbershop_id)
        .maybeSingle();

      if (existingRole) {
        // User is already a member - handle resend
        if (resend) {
          // Update status to pending and send password reset email
          const { error: updateStatusError } = await supabaseAdmin
            .from('user_barbershop_roles')
            .update({ status: 'pending' })
            .eq('id', existingRole.id);

          if (updateStatusError) {
            console.error('Error updating status:', updateStatusError);
          }

          // Send password reset email to re-activate
          const redirectUrl = `${origin}/update-password`;
          
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
            email,
            { redirectTo: redirectUrl }
          );

          if (resetError) {
            console.error('Error sending reset email:', resetError);
            
            // Handle rate limit error gracefully
            if (resetError.message?.includes('security purposes') || resetError.status === 429) {
              return new Response(
                JSON.stringify({ 
                  error: 'Aguarde alguns segundos antes de reenviar o convite.',
                  rate_limited: true 
                }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            return new Response(
              JSON.stringify({ error: resetError.message || 'Failed to resend invite' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('Password reset email sent to:', email);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Convite reenviado para ${email}`,
              resent: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: 'User is already a member of this barbershop' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // User exists but NOT a member of this barbershop - RE-INVITE (Re-hiring)
      console.log('Re-inviting existing user to barbershop (re-hiring flow)');

      // CRITICAL: Update/insert user_settings with the form data
      const { error: upsertSettingsError } = await supabaseAdmin
        .from('user_settings')
        .upsert({
          user_id: existingUser.id,
          email: email,
          nome: name || existingUser.user_metadata?.nome || null,
          numero: phone || existingUser.user_metadata?.numero || null,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (upsertSettingsError) {
        console.error('Error upserting user_settings:', upsertSettingsError);
      } else {
        console.log('User settings updated for existing user');
      }

      // Insert role for this barbershop with status = 'pending'
      const { error: insertRoleError } = await supabaseAdmin
        .from('user_barbershop_roles')
        .insert({
          user_id: existingUser.id,
          barbershop_id: barbershop_id,
          role: 'staff',
          permissions: memberPermissions,
          status: 'pending',  // <-- LOCAL STATUS: pending until they set password
          is_service_provider: true  // Staff are always service providers
        });

      if (insertRoleError) {
        console.error('Error adding existing user to barbershop:', insertRoleError);
        return new Response(
          JSON.stringify({ error: 'Failed to add user to team' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create default staff schedules for the re-hired user
      const defaultSchedules = [];
      for (let day = 0; day <= 6; day++) {
        const isWorkingDay = day >= 1 && day <= 5;
        defaultSchedules.push({
          user_id: existingUser.id,
          barbershop_id: barbershop_id,
          day_of_week: day,
          start_time: '08:00',
          end_time: '18:00',
          is_working: isWorkingDay,
        });
      }

      const { error: scheduleError } = await supabaseAdmin
        .from('staff_schedules')
        .insert(defaultSchedules);

      if (scheduleError) {
        console.error('Error creating default staff schedules for re-hired user:', scheduleError);
      } else {
        console.log('Default staff schedules created for re-hired user');
      }

      console.log('Existing user added to barbershop as staff with pending status');
      
      // Send password reset email (acts as "Accept Invite" flow)
      const redirectUrl = `${origin}/update-password`;
      
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
        email,
        { redirectTo: redirectUrl }
      );

      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        // Don't fail - user was still added successfully
      } else {
        console.log('Password reset email sent to re-hired user');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Convite enviado para ${email}. O usuário precisará definir uma nova senha.`,
          existing_user: true,
          user_id: existingUser.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SCENARIO B: New User - Fresh Invite
    console.log('Creating new user invite');

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Nome é obrigatório para novos convites' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invite new user via Supabase Auth - redirect to update-password
    const redirectUrl = `${origin}/update-password`;
    
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectUrl,
        data: {
          nome: name,
          numero: phone || null,
          barbershop_id: barbershop_id,
          role: 'staff',
          permissions: memberPermissions,
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

    const newUserId = inviteData.user?.id;
    console.log('Invite sent successfully, new user ID:', newUserId);

    // CRITICAL: Manually insert into user_settings immediately
    if (newUserId) {
      const { error: insertSettingsError } = await supabaseAdmin
        .from('user_settings')
        .upsert({
          user_id: newUserId,
          email: email,
          nome: name,
          numero: phone || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (insertSettingsError) {
        console.error('Error inserting user_settings:', insertSettingsError);
      } else {
        console.log('User settings inserted for new user');
      }

      // CRITICAL: Manually insert into user_barbershop_roles with status = 'pending'
      const { error: insertRoleError } = await supabaseAdmin
        .from('user_barbershop_roles')
        .insert({
          user_id: newUserId,
          barbershop_id: barbershop_id,
          role: 'staff',
          permissions: memberPermissions,
          status: 'pending',  // <-- LOCAL STATUS: pending until they set password
          is_service_provider: true  // Staff are always service providers
        });

      if (insertRoleError) {
        console.error('Error inserting user_barbershop_roles:', insertRoleError);
      } else {
        console.log('User role inserted for new user with pending status');
        
        // Create default staff schedules for the new user
        const defaultSchedules = [];
        for (let day = 0; day <= 6; day++) {
          // Monday (1) to Friday (5) = working days
          const isWorkingDay = day >= 1 && day <= 5;
          defaultSchedules.push({
            user_id: newUserId,
            barbershop_id: barbershop_id,
            day_of_week: day,
            start_time: '08:00',
            end_time: '18:00',
            is_working: isWorkingDay,
          });
        }

        const { error: scheduleError } = await supabaseAdmin
          .from('staff_schedules')
          .insert(defaultSchedules);

        if (scheduleError) {
          console.error('Error creating default staff schedules:', scheduleError);
        } else {
          console.log('Default staff schedules created for new user');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Convite enviado para ${email}`,
        user_id: newUserId,
        existing_user: false
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
