-- Update get_next_class to use consistent "Class" naming
CREATE OR REPLACE FUNCTION public.get_next_class(current_class text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    -- Terminal classes - no auto-promotion
    WHEN current_class IN ('Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12') THEN NULL
    -- Pre-primary to primary progression
    WHEN current_class IN ('Nursery', 'nursery') THEN 'LKG'
    WHEN current_class IN ('LKG', 'lkg') THEN 'UKG'
    WHEN current_class IN ('UKG', 'ukg') THEN 'Class 1'
    -- Standard class progression (Basic Level)
    WHEN current_class IN ('Grade 1', 'Class 1', '1') THEN 'Class 2'
    WHEN current_class IN ('Grade 2', 'Class 2', '2') THEN 'Class 3'
    WHEN current_class IN ('Grade 3', 'Class 3', '3') THEN 'Class 4'
    WHEN current_class IN ('Grade 4', 'Class 4', '4') THEN 'Class 5'
    WHEN current_class IN ('Grade 5', 'Class 5', '5') THEN 'Class 6'
    WHEN current_class IN ('Grade 6', 'Class 6', '6') THEN 'Class 7'
    WHEN current_class IN ('Grade 7', 'Class 7', '7') THEN 'Class 8'
    WHEN current_class IN ('Grade 8', 'Class 8', '8') THEN 'Class 9'
    WHEN current_class IN ('Grade 9', 'Class 9', '9') THEN 'Class 10'
    -- Higher Secondary (Class 11 to 12 only, no cross-level promotion)
    WHEN current_class IN ('Grade 11', 'Class 11', '11') THEN 'Class 12'
    ELSE NULL
  END
$$;