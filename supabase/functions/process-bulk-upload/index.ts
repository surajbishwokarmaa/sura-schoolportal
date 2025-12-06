import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate secure random password
function generateSecurePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// Sanitize text input to prevent XSS and injection
function sanitizeInput(input: string | undefined | null, maxLength = 255): string {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'";&]/g, '') // Remove dangerous characters
    .trim()
    .slice(0, maxLength);
}

// Validate phone number format
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Map generic error messages
function mapErrorMessage(error: any, context: string): string {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('duplicate') || message.includes('already exists') || message.includes('already been registered')) {
    return `${context}: Account already exists`;
  }
  if (message.includes('invalid email')) {
    return `${context}: Invalid email format`;
  }
  if (message.includes('password')) {
    return `${context}: Password does not meet requirements`;
  }
  
  // Log detailed error server-side only
  console.error(`Detailed error for ${context}:`, error);
  return `${context}: Unable to process record`;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    // Create client with user's token to verify admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify the user is an admin
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check admin role using service client
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requestData, type } = await req.json();
    
    // Validate request data
    if (!Array.isArray(requestData) || requestData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (requestData.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 records allowed per upload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Admin ${user.id} processing ${type} upload with ${requestData.length} records`);

    // Step 1: Validate and map columns using Lovable AI
    const aiValidationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a data validation assistant for school management. Analyze the uploaded data and map column headers to expected fields. Return a JSON object with: { "isValid": boolean, "mappedData": array, "suggestions": array of corrections made, "errors": array of validation errors }`
          },
          {
            role: 'user',
            content: `Validate and map this ${type} data: ${JSON.stringify(requestData.slice(0, 5))}. 
            Expected fields for ${type === 'students' ? 'students: Roll No, Full Name, Gender, Date of Birth, Class, Section, Phone (Family), Address, Parent Name' : 'teachers: Full Name, Gender, Subject, Class Assigned, Phone, Email, Password, Address'}. 
            Map similar columns (e.g., "Student Name" -> "Full Name"). Return valid JSON only.`
          }
        ],
      }),
    });

    let validation = { isValid: true, mappedData: requestData, suggestions: [], errors: [] as string[] };
    
    if (aiValidationResponse.ok) {
      try {
        const aiResult = await aiValidationResponse.json();
        const aiContent = aiResult.choices[0]?.message?.content;
        if (aiContent) {
          validation = JSON.parse(aiContent.replace(/```json|```/g, '').trim());
        }
      } catch {
        console.log('AI validation parsing failed, using raw data');
      }
    }

    console.log('AI Validation completed');

    // Step 2: Process data based on type
    const summary = {
      total: requestData.length,
      added: 0,
      skipped: 0,
      errors: validation.errors || [],
      credentials: [] as { name: string; email: string; password: string }[]
    };

    if (type === 'students') {
      for (const row of requestData) {
        try {
          // Map and sanitize columns
          const rollNo = sanitizeInput(row['Roll No'] || row['roll_no'] || row['Roll Number'], 20);
          const fullName = sanitizeInput(row['Full Name'] || row['full_name'] || row['Name'] || row['Student Name'], 100);
          const gender = sanitizeInput((row['Gender'] || row['gender'] || ''), 10).toLowerCase();
          const dob = row['Date of Birth'] || row['dob'] || row['DOB'];
          const classValue = sanitizeInput(row['Class'] || row['class'], 20);
          const section = sanitizeInput(row['Section'] || row['section'], 10);
          const parentPhone = sanitizeInput(row['Phone (Family)'] || row['parent_phone'] || row['Phone'], 20);
          const address = sanitizeInput(row['Address'] || row['address'], 500);
          const parentName = sanitizeInput(row['Parent Name'] || row['parent_name'], 100);

          // Validate required fields
          if (!rollNo || !fullName || !classValue || !section || !parentPhone) {
            summary.errors.push(`Roll ${rollNo || 'unknown'}: Missing required fields`);
            summary.skipped++;
            continue;
          }
          
          if (!validatePhone(parentPhone)) {
            summary.errors.push(`Roll ${rollNo}: Invalid phone number`);
            summary.skipped++;
            continue;
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from('students')
            .select('id')
            .eq('roll_no', rollNo)
            .single();

          if (existing) {
            summary.skipped++;
            continue;
          }

          // Generate secure password
          const securePassword = generateSecurePassword();
          const studentEmail = `student${rollNo}@school.edu.np`;

          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: studentEmail,
            password: securePassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role: 'student',
              phone: parentPhone
            }
          });

          if (authError) {
            summary.errors.push(mapErrorMessage(authError, `Roll ${rollNo}`));
            summary.skipped++;
            continue;
          }

          // Insert student record
          const { error: insertError } = await supabase
            .from('students')
            .insert({
              user_id: authUser.user.id,
              name: fullName,
              roll_no: rollNo,
              gender: gender === 'male' || gender === 'm' ? 'male' : gender === 'female' || gender === 'f' ? 'female' : 'other',
              dob: dob,
              class: classValue,
              section: section,
              parent_phone: parentPhone,
              address: address,
              parent_name: parentName,
              is_active: true
            });

          if (insertError) {
            summary.errors.push(mapErrorMessage(insertError, `Roll ${rollNo}`));
            summary.skipped++;
          } else {
            summary.added++;
            summary.credentials.push({
              name: fullName,
              email: studentEmail,
              password: securePassword
            });
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push('Unable to process a record');
          summary.skipped++;
        }
      }
    } else if (type === 'teachers') {
      for (const row of requestData) {
        try {
          const fullName = sanitizeInput(row['Full Name'] || row['full_name'] || row['Name'], 100);
          const email = sanitizeInput(row['Email'] || row['email'], 255);
          const phone = sanitizeInput(row['Phone'] || row['phone'], 20);
          const address = sanitizeInput(row['Address'] || row['address'], 500);

          // Validate required fields
          if (!fullName || !email) {
            summary.errors.push(`${email || 'unknown'}: Missing required fields`);
            summary.skipped++;
            continue;
          }
          
          if (!validateEmail(email)) {
            summary.errors.push(`${fullName}: Invalid email format`);
            summary.skipped++;
            continue;
          }
          
          if (phone && !validatePhone(phone)) {
            summary.errors.push(`${fullName}: Invalid phone number`);
            summary.skipped++;
            continue;
          }

          // Collect and sanitize subjects and classes
          const subjects: string[] = [];
          const classes: string[] = [];
          
          for (let i = 1; i <= 5; i++) {
            const subject = sanitizeInput(row[`Subject ${i}`] || row[`subject_${i}`], 50);
            const classVal = sanitizeInput(row[`Class ${i}`] || row[`class_${i}`], 20);
            if (subject) subjects.push(subject);
            if (classVal) classes.push(classVal);
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from('teachers')
            .select('id')
            .eq('email', email)
            .single();

          if (existing) {
            summary.skipped++;
            continue;
          }

          // Generate secure password (ignore any provided password)
          const securePassword = generateSecurePassword();

          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: securePassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role: 'teacher',
              phone: phone
            }
          });

          if (authError) {
            summary.errors.push(mapErrorMessage(authError, fullName));
            summary.skipped++;
            continue;
          }

          // Insert teacher record
          const { error: insertError } = await supabase
            .from('teachers')
            .insert({
              user_id: authUser.user.id,
              name: fullName,
              email: email,
              phone: phone,
              subjects: subjects,
              classes_assigned: classes
            });

          if (insertError) {
            summary.errors.push(mapErrorMessage(insertError, fullName));
            summary.skipped++;
          } else {
            summary.added++;
            summary.credentials.push({
              name: fullName,
              email: email,
              password: securePassword
            });
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push('Unable to process a record');
          summary.skipped++;
        }
      }
    }

    // Step 3: Create auto-notice
    if (summary.added > 0) {
      const noticeTitle = type === 'students' 
        ? `📢 Student Data Updated`
        : `📢 New Teachers Added`;
      
      const noticeDescription = type === 'students'
        ? `${summary.added} student records have been added. ${summary.skipped > 0 ? `${summary.skipped} records were skipped.` : ''}`
        : `${summary.added} teacher records have been added. ${summary.skipped > 0 ? `${summary.skipped} records were skipped.` : ''}`;

      await supabase.from('notices').insert({
        title: noticeTitle,
        description: noticeDescription,
        visible_to: 'all',
        is_auto_generated: true,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: {
          total: summary.total,
          added: summary.added,
          skipped: summary.skipped,
          errors: summary.errors,
          credentials: summary.credentials
        },
        aiSuggestions: validation.suggestions 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing the upload' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
