-- Create a SECURITY DEFINER function to get teacher email by phone for login
-- This bypasses RLS so unauthenticated users can look up their email
CREATE OR REPLACE FUNCTION public.get_teacher_login_info(teacher_phone_input text)
RETURNS TABLE(teacher_email text, teacher_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.email::TEXT as teacher_email,
    t.name::TEXT as teacher_name
  FROM teachers t
  WHERE t.phone = teacher_phone_input
  LIMIT 1;
END;
$$;