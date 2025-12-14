-- Drop the problematic teacher policy
DROP POLICY IF EXISTS "Teachers manage assigned results" ON public.results;

-- Create separate policies for SELECT, INSERT, UPDATE, DELETE for teachers
-- This avoids the issue where WITH CHECK references the row being inserted

-- SELECT: Teachers can view results for their assigned classes
CREATE POLICY "Teachers can view assigned results" 
ON public.results 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id IN (
    SELECT id FROM teachers WHERE user_id = auth.uid()
  )
);

-- INSERT: Teachers can insert results for their assigned subjects and classes
CREATE POLICY "Teachers can insert results" 
ON public.results 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id IN (
    SELECT id FROM teachers WHERE user_id = auth.uid()
  )
  AND subject IN (
    SELECT unnest(subjects) FROM teachers WHERE user_id = auth.uid()
  )
  AND class IN (
    SELECT unnest(classes_assigned) FROM teachers WHERE user_id = auth.uid()
  )
);

-- UPDATE: Teachers can update their own results
CREATE POLICY "Teachers can update own results" 
ON public.results 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id IN (
    SELECT id FROM teachers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id IN (
    SELECT id FROM teachers WHERE user_id = auth.uid()
  )
);

-- DELETE: Teachers can delete their own results
CREATE POLICY "Teachers can delete own results" 
ON public.results 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id IN (
    SELECT id FROM teachers WHERE user_id = auth.uid()
  )
);