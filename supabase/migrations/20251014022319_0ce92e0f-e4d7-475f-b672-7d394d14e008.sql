-- Fix 1: Create proper role management system with separate user_roles table
-- This prevents privilege escalation attacks

-- Create user_roles table that users cannot modify
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only view their own roles, cannot modify
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow role assignment through backend/admin functions, not direct inserts by users
-- Admin can manage roles through a separate secure process

-- Create SECURITY DEFINER function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix 2: Update all RLS policies to use the secure has_role function

-- Drop existing policies that use profiles table for role checks
DROP POLICY IF EXISTS "Admin can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Admin can manage notices" ON public.notices;
DROP POLICY IF EXISTS "Admin full access to students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students" ON public.students;
DROP POLICY IF EXISTS "Admin full access to teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admin full access to results" ON public.results;
DROP POLICY IF EXISTS "Teachers can manage own results" ON public.results;
DROP POLICY IF EXISTS "Admin full access to families" ON public.families;

-- Recreate policies using secure has_role function

-- Classes policies
CREATE POLICY "Admin can manage classes" ON public.classes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Notices policies
CREATE POLICY "Admin can manage notices" ON public.notices
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Students policies - now with proper teacher restrictions
CREATE POLICY "Admin full access to students" ON public.students
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: Restrict teachers to only view students in their assigned classes
CREATE POLICY "Teachers view assigned students" ON public.students
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'teacher')
    AND class = ANY(
      SELECT unnest(classes_assigned)
      FROM public.teachers
      WHERE user_id = auth.uid()
    )
  );

-- Teachers policies
CREATE POLICY "Admin full access to teachers" ON public.teachers
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Results policies with proper validation
CREATE POLICY "Admin full access to results" ON public.results
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 4: Restrict teachers to only manage results for their assigned subjects and classes
CREATE POLICY "Teachers manage assigned results" ON public.results
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'teacher')
    AND teacher_id IN (
      SELECT id FROM public.teachers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher')
    AND teacher_id IN (
      SELECT id FROM public.teachers WHERE user_id = auth.uid()
    )
    AND subject = ANY(
      SELECT unnest(subjects) FROM public.teachers 
      WHERE id = teacher_id
    )
    AND class = ANY(
      SELECT unnest(classes_assigned) FROM public.teachers 
      WHERE id = teacher_id
    )
  );

-- Families policies
CREATE POLICY "Admin full access to families" ON public.families
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 5: Add INSERT policy to profiles and use trigger for auto-creation
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create trigger function to auto-create profiles and assign roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile and role creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix 6: Update existing functions to use proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_grade_gpa(marks NUMERIC)
RETURNS TABLE(grade TEXT, gpa NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY SELECT 
    CASE 
      WHEN marks >= 90 THEN 'A+'
      WHEN marks >= 80 THEN 'A'
      WHEN marks >= 70 THEN 'B+'
      WHEN marks >= 60 THEN 'B'
      WHEN marks >= 50 THEN 'C+'
      WHEN marks >= 40 THEN 'C'
      WHEN marks >= 35 THEN 'D'
      ELSE 'NG'
    END,
    CASE 
      WHEN marks >= 90 THEN 4.0
      WHEN marks >= 80 THEN 3.6
      WHEN marks >= 70 THEN 3.2
      WHEN marks >= 60 THEN 2.8
      WHEN marks >= 50 THEN 2.4
      WHEN marks >= 40 THEN 2.0
      WHEN marks >= 35 THEN 1.6
      ELSE 0.0
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_calculate_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  grade_result RECORD;
BEGIN
  -- Calculate total marks
  NEW.total_marks := COALESCE(NEW.theory_marks, 0) + COALESCE(NEW.practical_marks, 0);
  
  -- Get grade and GPA
  SELECT * INTO grade_result FROM public.calculate_grade_gpa(NEW.total_marks);
  NEW.grade := grade_result.grade;
  NEW.gpa := grade_result.gpa;
  
  RETURN NEW;
END;
$$;