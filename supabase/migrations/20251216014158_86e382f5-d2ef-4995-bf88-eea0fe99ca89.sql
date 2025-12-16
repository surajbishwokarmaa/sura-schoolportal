CREATE OR REPLACE FUNCTION public.get_student_login_info(parent_phone_input text)
RETURNS TABLE(student_email text, student_name text, roll_no text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (
      'student_' ||
      regexp_replace(lower(s.class), '[^a-z0-9]', '', 'g') ||
      '_' ||
      regexp_replace(s.roll_no, '[[:space:]]', '', 'g') ||
      '@school.edu.np'
    )::text AS student_email,
    s.name::text AS student_name,
    s.roll_no::text AS roll_no
  FROM students s
  WHERE regexp_replace(s.parent_phone, '[^0-9]', '', 'g') = regexp_replace(parent_phone_input, '[^0-9]', '', 'g')
    AND s.is_active = true
  ORDER BY s.class, s.section, s.roll_no
  LIMIT 1;
END;
$$;