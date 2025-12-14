import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fixed admin credentials
const ADMIN_EMAIL = 'buddhadeep2057@gmail.com';
const ADMIN_PASSWORD = '12345678';
const ADMIN_NAME = 'Admin';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Setting up admin account...');

    // Check if admin user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const existingAdmin = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

    if (existingAdmin) {
      console.log('Admin user already exists, updating password...');
      
      // Update password for existing admin
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAdmin.id,
        { password: ADMIN_PASSWORD, email_confirm: true }
      );

      if (updateError) {
        console.error('Error updating admin:', updateError);
        throw updateError;
      }

      // Ensure admin role exists
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', existingAdmin.id)
        .eq('role', 'admin')
        .single();

      if (!existingRole) {
        await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: existingAdmin.id, role: 'admin' });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin account updated successfully',
          email: ADMIN_EMAIL 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: ADMIN_NAME,
        role: 'admin'
      }
    });

    if (authError) {
      console.error('Error creating admin:', authError);
      throw authError;
    }

    console.log('Admin account created:', authUser.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin account created successfully',
        email: ADMIN_EMAIL,
        userId: authUser.user.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in setup-admin function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to setup admin account';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
