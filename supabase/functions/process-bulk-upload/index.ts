import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data: requestData, type } = await req.json();
    console.log(`Processing ${type} upload with ${requestData.length} records`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (!aiValidationResponse.ok) {
      throw new Error('AI validation failed');
    }

    const aiResult = await aiValidationResponse.json();
    const aiContent = aiResult.choices[0].message.content;
    
    let validation;
    try {
      validation = JSON.parse(aiContent.replace(/```json|```/g, '').trim());
    } catch {
      validation = { isValid: true, mappedData: requestData, suggestions: [], errors: [] };
    }

    console.log('AI Validation result:', validation);

    // Step 2: Process data based on type
    const summary = {
      total: requestData.length,
      added: 0,
      skipped: 0,
      errors: validation.errors || []
    };

    if (type === 'students') {
      for (const row of requestData) {
        try {
          // Map columns with flexibility
          const rollNo = row['Roll No'] || row['roll_no'] || row['Roll Number'];
          const fullName = row['Full Name'] || row['full_name'] || row['Name'] || row['Student Name'];
          const gender = (row['Gender'] || row['gender'] || '').toLowerCase();
          const dob = row['Date of Birth'] || row['dob'] || row['DOB'];
          const classValue = row['Class'] || row['class'];
          const section = row['Section'] || row['section'];
          const parentPhone = row['Phone (Family)'] || row['parent_phone'] || row['Phone'];
          const address = row['Address'] || row['address'] || '';
          const parentName = row['Parent Name'] || row['parent_name'] || '';

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

          // Create auth user for student
          const tempPassword = `student${rollNo}`;
          const studentEmail = `student${rollNo}@school.edu.np`;

          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: studentEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role: 'student',
              phone: parentPhone
            }
          });

          if (authError) {
            console.error('Auth creation error:', authError);
            summary.errors.push(`Row ${rollNo}: ${authError.message}`);
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
            console.error('Insert error:', insertError);
            summary.errors.push(`Row ${rollNo}: ${insertError.message}`);
            summary.skipped++;
          } else {
            summary.added++;
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push(`Row error: ${error.message}`);
          summary.skipped++;
        }
      }
    } else if (type === 'teachers') {
      for (const row of requestData) {
        try {
          const fullName = row['Full Name'] || row['full_name'] || row['Name'];
          const gender = (row['Gender'] || row['gender'] || '').toLowerCase();
          const email = row['Email'] || row['email'];
          const phone = row['Phone'] || row['phone'];
          const password = row['Password'] || row['password'] || 'teacher123';
          const address = row['Address'] || row['address'] || '';

          // Collect subjects and classes
          const subjects = [];
          const classes = [];
          
          for (let i = 1; i <= 5; i++) {
            const subject = row[`Subject ${i}`] || row[`subject_${i}`];
            const classVal = row[`Class ${i}`] || row[`class_${i}`];
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

          // Create auth user for teacher
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              role: 'teacher',
              phone: phone
            }
          });

          if (authError) {
            console.error('Auth creation error:', authError);
            summary.errors.push(`${email}: ${authError.message}`);
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
            console.error('Insert error:', insertError);
            summary.errors.push(`${email}: ${insertError.message}`);
            summary.skipped++;
          } else {
            summary.added++;
          }
        } catch (error: any) {
          console.error('Row processing error:', error);
          summary.errors.push(`Row error: ${error.message}`);
          summary.skipped++;
        }
      }
    }

    // Step 3: Create auto-notice with better visibility settings
    if (summary.added > 0) {
      const noticeTitle = type === 'students' 
        ? `📢 Student Data Updated`
        : `📢 New Teachers Added`;
      
      const noticeDescription = type === 'students'
        ? `${summary.added} student records have been successfully added to the system. ${summary.skipped > 0 ? `${summary.skipped} duplicate records were skipped.` : ''}`
        : `${summary.added} new teachers have been added to the system. ${summary.skipped > 0 ? `${summary.skipped} duplicate records were skipped.` : ''}`;

      await supabase.from('notices').insert({
        title: noticeTitle,
        description: noticeDescription,
        visible_to: 'all',
        is_auto_generated: true,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        aiSuggestions: validation.suggestions 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
