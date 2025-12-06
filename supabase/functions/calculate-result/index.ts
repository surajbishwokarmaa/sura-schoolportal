import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    // Verify user is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if user is teacher or admin
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roleData } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['teacher', 'admin']);
    
    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Teacher or admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { theoryMarks, practicalMarks, fullMarks = 100 } = await req.json();
    
    // Validate inputs
    if (theoryMarks === undefined || practicalMarks === undefined) {
      return new Response(
        JSON.stringify({ error: 'Theory and practical marks are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const theory = Number(theoryMarks);
    const practical = Number(practicalMarks);
    const full = Number(fullMarks);
    
    if (isNaN(theory) || isNaN(practical) || isNaN(full)) {
      return new Response(
        JSON.stringify({ error: 'Invalid marks format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (theory < 0 || practical < 0 || theory > 100 || practical > 100) {
      return new Response(
        JSON.stringify({ error: 'Marks must be between 0 and 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalMarks = theory + practical;
    const percentage = (totalMarks / full) * 100;

    // Calculate grade and GPA based on percentage
    let grade: string;
    let gpa: number;
    let remarks: string;

    if (percentage >= 90) {
      grade = "A+";
      gpa = 4.0;
      remarks = "Outstanding performance";
    } else if (percentage >= 80) {
      grade = "A";
      gpa = 3.6;
      remarks = "Excellent work";
    } else if (percentage >= 70) {
      grade = "B+";
      gpa = 3.2;
      remarks = "Very good";
    } else if (percentage >= 60) {
      grade = "B";
      gpa = 2.8;
      remarks = "Good";
    } else if (percentage >= 50) {
      grade = "C+";
      gpa = 2.4;
      remarks = "Satisfactory";
    } else if (percentage >= 40) {
      grade = "C";
      gpa = 2.0;
      remarks = "Pass";
    } else {
      grade = "NG";
      gpa = 0.8;
      remarks = "Needs improvement";
    }

    // Call OpenRouter API for AI-enhanced remarks
    if (openRouterApiKey) {
      try {
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [
              {
                role: 'system',
                content: 'You are an educational assistant. Provide brief, encouraging feedback for student performance in 1-2 sentences.'
              },
              {
                role: 'user',
                content: `Student scored ${totalMarks}/${full} (${percentage.toFixed(1)}%), grade ${grade}. Provide brief encouraging feedback.`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiRemarks = aiData.choices[0]?.message?.content?.trim();
          if (aiRemarks && aiRemarks.length < 500) {
            remarks = aiRemarks;
          }
        }
      } catch (aiError) {
        console.error('AI remarks generation failed, using default:', aiError);
      }
    }

    return new Response(
      JSON.stringify({
        totalMarks,
        percentage: Number(percentage.toFixed(2)),
        grade,
        gpa,
        remarks,
        isPassing: percentage >= 40
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-result function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while calculating results' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
