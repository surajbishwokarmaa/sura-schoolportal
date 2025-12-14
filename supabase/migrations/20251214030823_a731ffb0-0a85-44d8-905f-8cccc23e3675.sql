-- Add RLS policy to allow students to view siblings (same parent_phone)
CREATE POLICY "Students can view siblings with same parent phone" 
ON public.students 
FOR SELECT 
USING (
  parent_phone IN (
    SELECT s.parent_phone 
    FROM students s 
    WHERE s.user_id = auth.uid()
  )
);