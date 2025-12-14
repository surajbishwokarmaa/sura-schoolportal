-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Students can view siblings with same parent phone" ON public.students;

-- Create a security definer function to get parent phone for a user (avoids recursion)
CREATE OR REPLACE FUNCTION public.get_user_parent_phone(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_phone 
  FROM public.students 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- Create new RLS policy using the function (no recursion)
CREATE POLICY "Students can view siblings with same parent phone" 
ON public.students 
FOR SELECT 
USING (
  parent_phone = public.get_user_parent_phone(auth.uid())
);