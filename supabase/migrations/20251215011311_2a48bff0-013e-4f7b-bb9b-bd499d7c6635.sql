-- Fix: System guides should require authentication
DROP POLICY IF EXISTS "Everyone can view system guides" ON public.system_guides;

CREATE POLICY "Authenticated users can view system guides" 
ON public.system_guides 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add rate limiting for password reset requests via database constraint
-- Limit to 3 requests per parent_phone per hour
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count requests from same phone in last hour
  SELECT COUNT(*) INTO recent_count
  FROM password_reset_requests
  WHERE parent_phone = NEW.parent_phone
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many password reset requests. Please try again later.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for rate limiting
DROP TRIGGER IF EXISTS password_reset_rate_limit_trigger ON password_reset_requests;
CREATE TRIGGER password_reset_rate_limit_trigger
BEFORE INSERT ON password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION check_password_reset_rate_limit();