-- Fix 1: Update GPA calculation to match Nepal system exactly
CREATE OR REPLACE FUNCTION public.calculate_grade_gpa(marks numeric)
RETURNS TABLE(grade text, gpa numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY SELECT 
    CASE 
      WHEN marks >= 90 THEN 'A+'
      WHEN marks >= 80 THEN 'A'
      WHEN marks >= 70 THEN 'B+'
      WHEN marks >= 60 THEN 'B'
      WHEN marks >= 50 THEN 'C+'
      WHEN marks >= 40 THEN 'C'
      WHEN marks < 40 THEN 'NG'
      ELSE 'NG'
    END,
    CASE 
      WHEN marks >= 90 THEN 4.0
      WHEN marks >= 80 THEN 3.6
      WHEN marks >= 70 THEN 3.2
      WHEN marks >= 60 THEN 2.8
      WHEN marks >= 50 THEN 2.4
      WHEN marks >= 40 THEN 2.0
      WHEN marks < 40 THEN 0.8
      ELSE 0.8
    END;
END;
$function$;

-- Fix 2: Update subjects table to support Computer subject (50/50 split)
-- Add a column to track if a subject has equal theory/practical split
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS is_equal_split boolean DEFAULT false;

-- Update Computer subject to have equal split
UPDATE public.subjects 
SET theory_full_marks = 50, 
    practical_full_marks = 50,
    is_equal_split = true
WHERE LOWER(name) = 'computer';

-- Fix 3: Add notice auto-publish functionality
-- Update notices table to support auto-generated notices
ALTER TABLE public.notices 
ADD COLUMN IF NOT EXISTS is_auto_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS visible_to text DEFAULT 'all';

-- Add index for better performance on notices
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_visible_to ON public.notices(visible_to);