import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map generic error messages
function mapErrorMessage(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('already been registered') || message.includes('duplicate')) {
    return 'An account with this email already exists';
  }
  if (message.includes('invalid email')) {
    return 'Invalid email format';
  }
  if (message.includes('password')) {
    return 'Password does not meet security requirements';
  }
  
  // Log detailed error server-side only
  console.error('Detailed auth error:', error);
  return 'Unable to create account';
}

// Sanitize text input to prevent XSS and injection
function sanitizeInput(input: string | undefined | null, maxLength = 255): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'";&]/g, '')
    .trim()
    .slice(0, maxLength);
}

// Validate phone number format
function validatePhone(phone: string): boolean {
  if (!phone) return true; // Phone is optional
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (password.length > 72) {
    return { valid: false, message: 'Password must be less than 72 characters' };
  }
  // Check for at least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter and one number' };
  }
  return { valid: true, message: '' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Create client with user's token to verify admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify the user is authenticated
    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check admin role using service client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .single();
    
    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();
    
    // Sanitize all inputs
    const email = sanitizeInput(rawBody.email, 255).toLowerCase();
    const password = rawBody.password || '';
    const role = sanitizeInput(rawBody.role, 20);
    const fullName = sanitizeInput(rawBody.fullName, 100);
    const phone = rawBody.phone ? sanitizeInput(rawBody.phone, 20).replace(/\D/g, '') : null;

    console.log('Admin creating user account:', { email, role, fullName, requestedBy: callerUser.id });

    // Validate required fields
    if (!email || !password || !role || !fullName) {
      const missing = [];
      if (!email) missing.push('email');
      if (!password) missing.push('password');
      if (!role) missing.push('role');
      if (!fullName) missing.push('fullName');
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate full name length
    if (fullName.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Full name must be at least 2 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate phone if provided
    if (phone && !validatePhone(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format (must be 10-15 digits)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate role
    const validRoles = ['admin', 'teacher', 'student'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user with admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        phone: phone || null
      }
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: mapErrorMessage(authError) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', authUser.user.id);

    // Ensure profile + user_roles exist (required by FK constraints in app tables)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: authUser.user.id,
          full_name: fullName,
          phone: phone || null,
          role: role,
          photo_url: null,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('Failed to upsert profile:', profileError);
      // cleanup auth user to avoid orphan
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: authUser.user.id, role }, { onConflict: 'user_id,role' });

    return new Response(
      JSON.stringify({ user: authUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-user-account function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while creating the account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
