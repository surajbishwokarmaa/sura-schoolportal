-- Drop the old conflicting unique CONSTRAINT (not index)
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_student_id_subject_term_key;

-- Drop existing teacher RLS policies to recreate them properly
DROP POLICY IF EXISTS "Teachers can view assigned results" ON public.results;
DROP POLICY IF EXISTS "Teachers can insert results" ON public.results;
DROP POLICY IF EXISTS "Teachers can update own results" ON public.results;
DROP POLICY IF EXISTS "Teachers can delete own results" ON public.results;

-- Create a security definer function to check if teacher is assigned to class/subject
CREATE OR REPLACE FUNCTION public.teacher_can_manage_result(
  _teacher_id uuid,
  _class text,
  _subject text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.id = _teacher_id
      AND t.user_id = auth.uid()
      AND _class = ANY(t.classes_assigned)
      AND _subject = ANY(t.subjects)
  )
$$;

-- Create a function to get teacher id for current user
CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
$$;

-- SELECT: Teachers can view results they created
CREATE POLICY "Teachers can view assigned results" 
ON public.results 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
);

-- INSERT: Teachers can insert results for their assigned subjects and classes
CREATE POLICY "Teachers can insert results" 
ON public.results 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
  AND teacher_can_manage_result(teacher_id, class, subject)
);

-- UPDATE: Teachers can update their own results
CREATE POLICY "Teachers can update own results" 
ON public.results 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
);

-- DELETE: Teachers can delete their own results
CREATE POLICY "Teachers can delete own results" 
ON public.results 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
);