import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theoryMarks, practicalMarks, fullMarks = 100 } = await req.json();
    
    if (theoryMarks === undefined || practicalMarks === undefined) {
      return new Response(
        JSON.stringify({ error: 'Theory and practical marks are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalMarks = Number(theoryMarks) + Number(practicalMarks);
    const percentage = (totalMarks / fullMarks) * 100;

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
              content: `Student scored ${totalMarks}/${fullMarks} (${percentage.toFixed(1)}%), grade ${grade}. Provide brief encouraging feedback.`
            }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiRemarks = aiData.choices[0]?.message?.content?.trim();
        if (aiRemarks) {
          remarks = aiRemarks;
        }
      }
    } catch (aiError) {
      console.error('AI remarks generation failed, using default:', aiError);
      // Continue with default remarks if AI fails
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
