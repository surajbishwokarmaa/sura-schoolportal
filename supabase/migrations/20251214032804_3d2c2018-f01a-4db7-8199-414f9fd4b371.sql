-- Create password reset requests table for students
CREATE TABLE public.password_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  class TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  email TEXT,
  message TEXT DEFAULT 'Forgot password request',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a password reset request (public form)
CREATE POLICY "Anyone can create password reset request"
ON public.password_reset_requests
FOR INSERT
WITH CHECK (true);

-- Admin can view and manage all requests
CREATE POLICY "Admin can manage password reset requests"
ON public.password_reset_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));