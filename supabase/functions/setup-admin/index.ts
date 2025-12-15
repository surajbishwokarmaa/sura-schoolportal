import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Get admin credentials from secure environment variables
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');
    const adminName = Deno.env.get('ADMIN_NAME') || 'Admin';
    
    if (!adminEmail || !adminPassword) {
      console.error('Admin credentials not configured in environment');
      return new Response(
        JSON.stringify({ error: 'Admin credentials not configured. Please set ADMIN_EMAIL and ADMIN_PASSWORD secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate password strength
    if (adminPassword.length < 12) {
      return new Response(
        JSON.stringify({ error: 'Admin password must be at least 12 characters for security' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
      console.error('Error listing users');
      throw new Error('Failed to check existing users');
    }

    const existingAdmin = existingUsers?.users?.find(u => u.email === adminEmail);

    if (existingAdmin) {
      console.log('Admin user already exists, updating...');
      
      // Update password for existing admin
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAdmin.id,
        { password: adminPassword, email_confirm: true }
      );

      if (updateError) {
        console.error('Error updating admin');
        throw new Error('Failed to update admin account');
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
          message: 'Admin account updated successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        role: 'admin'
      }
    });

    if (authError) {
      console.error('Error creating admin');
      throw new Error('Failed to create admin account');
    }

    console.log('Admin account created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin account created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Setup admin error');
    return new Response(
      JSON.stringify({ error: 'Failed to setup admin account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
