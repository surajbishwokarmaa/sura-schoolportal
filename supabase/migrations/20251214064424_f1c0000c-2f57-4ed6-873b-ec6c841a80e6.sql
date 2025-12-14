-- Drop existing policies
DROP POLICY IF EXISTS "Teachers can view assigned results" ON public.results;
DROP POLICY IF EXISTS "Teachers can insert results" ON public.results;
DROP POLICY IF EXISTS "Teachers can update own results" ON public.results;
DROP POLICY IF EXISTS "Teachers can delete own results" ON public.results;

-- Drop old function
DROP FUNCTION IF EXISTS public.teacher_can_manage_result(uuid, text, text);

-- Create simplified security definer function for teacher verification
CREATE OR REPLACE FUNCTION public.is_teacher_assigned_to_class_subject(
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
    WHERE t.user_id = auth.uid()
      AND _class = ANY(t.classes_assigned)
      AND (
        _subject = ANY(t.subjects) 
        OR lower(_subject) = ANY(SELECT lower(s) FROM unnest(t.subjects) s)
      )
  )
$$;

-- SELECT: Teachers can view results for classes they're assigned to
CREATE POLICY "Teachers can view assigned results" 
ON public.results 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND is_teacher_assigned_to_class_subject(class, subject)
);

-- INSERT: Teachers can insert results for their assigned subjects and classes  
CREATE POLICY "Teachers can insert results" 
ON public.results 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
  AND is_teacher_assigned_to_class_subject(class, subject)
);

-- UPDATE: Teachers can update results they created
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

-- DELETE: Teachers can delete results they created
CREATE POLICY "Teachers can delete own results" 
ON public.results 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::user_role) 
  AND teacher_id = get_current_teacher_id()
);