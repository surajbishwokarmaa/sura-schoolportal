-- Add RLS policy to allow students (and all authenticated users) to view teacher info
-- This enables the Staff Info page to display teachers for students and parents

CREATE POLICY "Students can view teachers for staff info" 
ON public.teachers 
FOR SELECT 
USING (true);

-- Note: This makes teacher name, phone, subjects visible to everyone
-- which is appropriate for a school staff directory