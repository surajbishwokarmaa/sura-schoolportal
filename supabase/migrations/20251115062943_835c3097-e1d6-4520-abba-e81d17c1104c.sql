-- Create a secure function to lookup student login info by parent phone
-- This runs with SECURITY DEFINER to bypass RLS during login lookup
CREATE OR REPLACE FUNCTION public.get_student_login_info(parent_phone_input TEXT)
RETURNS TABLE (
  student_email TEXT,
  student_name TEXT,
  roll_no TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ('student' || s.roll_no || '@school.edu.np')::TEXT as student_email,
    s.name::TEXT as student_name,
    s.roll_no::TEXT as roll_no
  FROM students s
  WHERE s.parent_phone = parent_phone_input
    AND s.is_active = true
  LIMIT 1;
END;
$$;