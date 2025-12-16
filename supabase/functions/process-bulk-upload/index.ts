import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate student password based on parent mobile: "sura" + first 2 digits + last 2 digits
function generateStudentPassword(parentMobile: string): string {
  const cleaned = parentMobile.replace(/\D/g, '');
  if (cleaned.length < 4) return 'sura0000';
  const first2 = cleaned.substring(0, 2);
  const last2 = cleaned.substring(cleaned.length - 2);
  return `sura${first2}${last2}`;
}

// Sanitize text input to prevent XSS and injection
function sanitizeInput(input: string | number | undefined | null, maxLength = 255): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'";&]/g, '')
    .trim()
    .slice(0, maxLength);
}

// Validate phone number format
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
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
        JSON.stringify({ error: 'Invalid data format - no data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (requestData.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 records per batch. System will process in batches automatically.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Admin ${user.id} processing ${type} upload with ${requestData.length} records`);

    // Process data based on type
    const summary = {
      total: requestData.length,
      added: 0,
      skipped: 0,
      errors: [] as string[],
      credentials: [] as { name: string; email: string; password: string }[]
    };

    if (type === 'students') {
      for (const row of requestData) {
        try {
          // Map columns from frontend format (case-insensitive)
          const studentName = sanitizeInput(row['student_name'] || row['Student_Name'] || row['STUDENT_NAME'] || row['name'], 100);
          const rollNo = sanitizeInput(row['roll_no'] || row['Roll_No'] || row['ROLL_NO'] || row['rollno'], 50);
          const classValue = sanitizeInput(row['class'] || row['Class'] || row['CLASS'], 20);
          const section = sanitizeInput(row['section'] || row['Section'] || row['SECTION'], 10);
          const parentMobile = sanitizeInput(row['parent_mobile'] || row['Parent_Mobile'] || row['PARENT_MOBILE'] || row['phone'], 20);
          const gender = sanitizeInput(row['gender'] || row['Gender'] || row['GENDER'], 10).toLowerCase();
          const dob = row['dob'] || row['DOB'] || row['Dob'] || row['date_of_birth'] || null;
          const parentName = sanitizeInput(row['parent_name'] || row['Parent_Name'] || row['PARENT_NAME'], 100);
          const address = sanitizeInput(row['address'] || row['Address'] || row['ADDRESS'], 500);

          // Validate required fields
          if (!studentName || !rollNo || !classValue || !section || !parentMobile) {
            const missing = [];
            if (!studentName) missing.push('student_name');
            if (!rollNo) missing.push('roll_no');
            if (!classValue) missing.push('class');
            if (!section) missing.push('section');
            if (!parentMobile) missing.push('parent_mobile');
            summary.errors.push(`Row with roll ${rollNo || 'unknown'}: Missing ${missing.join(', ')}`);
            summary.skipped++;
            continue;
          }
          
          // Clean and validate phone
          const cleanedPhone = parentMobile.replace(/\D/g, '');
          if (!validatePhone(cleanedPhone)) {
            summary.errors.push(`Roll ${rollNo}: Invalid phone number "${parentMobile}"`);
            summary.skipped++;
            continue;
          }

          // Check for existing student by roll_no AND class AND section combination
          const { data: existing } = await supabase
            .from('students')
            .select('id')
            .eq('roll_no', rollNo)
            .eq('class', classValue)
            .eq('section', section.toUpperCase())
            .maybeSingle();

          if (existing) {
            summary.errors.push(`Roll ${rollNo} in ${classValue} ${section}: Already exists`);
            summary.skipped++;
            continue;
          }

          // Generate universal student password: "sura" + first2 + last2
          const studentPassword = generateStudentPassword(cleanedPhone);
          
          // Make email unique by including class and roll (siblings can have same parent phone)
          const classSlug = classValue.toLowerCase().replace(/[^a-z0-9]/g, '');
          const studentEmail = `student_${classSlug}_${rollNo.replace(/\s/g, '')}@school.edu.np`;

          // Create auth user
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: studentEmail,
            password: studentPassword,
            email_confirm: true,
            user_metadata: {
              full_name: studentName,
              role: 'student',
              phone: cleanedPhone
            }
          });

          if (authError) {
            // If user already exists, try to get existing user
            if (authError.message?.includes('already') || authError.message?.includes('duplicate')) {
              summary.errors.push(`Roll ${rollNo}: Account already exists with email ${studentEmail}`);
            } else {
              summary.errors.push(mapErrorMessage(authError, `Roll ${rollNo}`));
            }
            summary.skipped++;
            continue;
          }

          // Determine gender value
          let genderValue: 'male' | 'female' | 'other' = 'other';
          if (gender === 'male' || gender === 'm' || gender === 'पुरुष') {
            genderValue = 'male';
          } else if (gender === 'female' || gender === 'f' || gender === 'महिला') {
            genderValue = 'female';
          }

          // Insert student record
          const { error: insertError } = await supabase
            .from('students')
            .insert({
              user_id: authUser.user.id,
              name: studentName,
              roll_no: rollNo,
              gender: genderValue,
              dob: dob || null,
              class: classValue,
              section: section.toUpperCase(),
              parent_phone: cleanedPhone,
              address: address || null,
              parent_name: parentName || null,
              is_active: true,
              graduation_status: 'active'
            });

          if (insertError) {
            summary.errors.push(mapErrorMessage(insertError, `Roll ${rollNo}`));
            // Try to clean up auth user if student insert failed
            try {
              await supabase.auth.admin.deleteUser(authUser.user.id);
            } catch (e) {
              console.error('Failed to cleanup auth user:', e);
            }
            summary.skipped++;
          } else {
            summary.added++;
            summary.credentials.push({
              name: studentName,
              email: studentEmail,
              password: studentPassword
            });
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push('Unable to process a student record');
          summary.skipped++;
        }
      }
    } else if (type === 'teachers') {
      for (const row of requestData) {
        try {
          // Map columns from frontend format (case-insensitive)
          const teacherName = sanitizeInput(row['teacher_name'] || row['Teacher_Name'] || row['TEACHER_NAME'] || row['name'], 100);
          const phoneNumber = sanitizeInput(row['phone_number'] || row['Phone_Number'] || row['PHONE_NUMBER'] || row['phone'], 20);
          const assignedClass = sanitizeInput(row['assigned_class'] || row['Assigned_Class'] || row['ASSIGNED_CLASS'] || row['classes'], 200);
          const assignedSubject = sanitizeInput(row['assigned_subject'] || row['Assigned_Subject'] || row['ASSIGNED_SUBJECT'] || row['subjects'], 200);
          const password = row['password'] || row['Password'] || row['PASSWORD'] || '';

          // Validate required fields
          if (!teacherName || !phoneNumber) {
            summary.errors.push(`Teacher "${teacherName || 'unknown'}": Missing teacher_name or phone_number`);
            summary.skipped++;
            continue;
          }
          
          // Clean and validate phone
          const cleanedPhone = phoneNumber.replace(/\D/g, '');
          if (!validatePhone(cleanedPhone)) {
            summary.errors.push(`${teacherName}: Invalid phone number "${phoneNumber}"`);
            summary.skipped++;
            continue;
          }

          // Validate password if provided
          const teacherPassword = password && password.trim().length >= 6 
            ? password.trim() 
            : `teacher${cleanedPhone.substring(cleanedPhone.length - 4)}`;

          // Parse comma-separated classes and subjects
          const classesArray = assignedClass
            .split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 0);
          
          const subjectsArray = assignedSubject
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);

          // Check for existing teacher by phone
          const { data: existing } = await supabase
            .from('teachers')
            .select('id')
            .eq('phone', cleanedPhone)
            .maybeSingle();

          if (existing) {
            summary.skipped++;
            continue;
          }

          // Generate email from phone
          const teacherEmail = `teacher${cleanedPhone}@school.edu.np`;

          // Create auth user
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: teacherEmail,
            password: teacherPassword,
            email_confirm: true,
            user_metadata: {
              full_name: teacherName,
              role: 'teacher',
              phone: cleanedPhone
            }
          });

          if (authError) {
            if (authError.message?.includes('already') || authError.message?.includes('duplicate')) {
              summary.errors.push(`${teacherName}: Account already exists`);
            } else {
              summary.errors.push(mapErrorMessage(authError, teacherName));
            }
            summary.skipped++;
            continue;
          }

          // Insert teacher record
          const { error: insertError } = await supabase
            .from('teachers')
            .insert({
              user_id: authUser.user.id,
              name: teacherName,
              email: teacherEmail,
              phone: cleanedPhone,
              subjects: subjectsArray,
              classes_assigned: classesArray
            });

          if (insertError) {
            summary.errors.push(mapErrorMessage(insertError, teacherName));
            // Try to clean up auth user if teacher insert failed
            try {
              await supabase.auth.admin.deleteUser(authUser.user.id);
            } catch (e) {
              console.error('Failed to cleanup auth user:', e);
            }
            summary.skipped++;
          } else {
            summary.added++;
            summary.credentials.push({
              name: teacherName,
              email: teacherEmail,
              password: teacherPassword
            });
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push('Unable to process a teacher record');
          summary.skipped++;
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be "students" or "teachers"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auto-notice if records were added
    if (summary.added > 0) {
      const noticeTitle = type === 'students' 
        ? `📢 Student Data Updated`
        : `📢 New Teachers Added`;
      
      const noticeDescription = type === 'students'
        ? `${summary.added} student records have been added via bulk upload. ${summary.skipped > 0 ? `${summary.skipped} records were skipped (duplicates or errors).` : ''}`
        : `${summary.added} teacher records have been added via bulk upload. ${summary.skipped > 0 ? `${summary.skipped} records were skipped (duplicates or errors).` : ''}`;

      await supabase.from('notices').insert({
        title: noticeTitle,
        description: noticeDescription,
        visible_to: 'all',
        is_auto_generated: true,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    console.log(`Batch complete: ${summary.added} added, ${summary.skipped} skipped, ${summary.errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: {
          total: summary.total,
          added: summary.added,
          skipped: summary.skipped,
          errors: summary.errors.slice(0, 50), // Limit errors returned
          credentials: summary.credentials
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: `Upload processing failed: ${error.message || 'Unknown error'}` }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
