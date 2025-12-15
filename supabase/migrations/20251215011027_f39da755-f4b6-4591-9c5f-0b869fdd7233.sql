-- Fix: Teachers table allows unauthenticated SELECT access
-- Change USING(true) to require authentication

DROP POLICY IF EXISTS "Students can view teachers for staff info" ON public.teachers;

CREATE POLICY "Authenticated users can view teachers" 
ON public.teachers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);