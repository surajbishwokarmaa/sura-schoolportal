-- Create default admin user and ensure proper setup (fixed version)
-- This migration creates the admin user and sets up the complete school management structure

-- First, ensure admin user exists with proper role
DO $$
DECLARE
  admin_user_id uuid;
  admin_exists boolean;
BEGIN
  -- Check if admin user exists
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'infosurajbishwokarma@gmail.com';
  
  -- If admin exists, ensure role is set
  IF admin_user_id IS NOT NULL THEN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_user_id) THEN
      INSERT INTO public.profiles (id, full_name, role, phone)
      VALUES (admin_user_id, 'Admin User', 'admin', NULL);
    ELSE
      -- Update existing profile to ensure admin role
      UPDATE public.profiles SET role = 'admin' WHERE id = admin_user_id;
    END IF;
    
    -- Check if role exists in user_roles
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_user_id AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (admin_user_id, 'admin');
    END IF;
  END IF;
END $$;

-- Create subjects table for proper subject management
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  theory_full_marks NUMERIC NOT NULL DEFAULT 75,
  practical_full_marks NUMERIC NOT NULL DEFAULT 25,
  total_marks NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers can view subjects" ON public.subjects;

-- Create policies for subjects
CREATE POLICY "Admin can manage subjects" ON public.subjects
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view subjects" ON public.subjects
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'student')
  );

-- Add sections column to classes if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'classes' 
    AND column_name = 'sections'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN sections TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Update results table to include subject_id reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'results' 
    AND column_name = 'subject_id'
  ) THEN
    ALTER TABLE public.results ADD COLUMN subject_id UUID REFERENCES public.subjects(id);
  END IF;
END $$;

-- Create trigger for subjects updated_at
DROP TRIGGER IF EXISTS update_subjects_updated_at ON public.subjects;
CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();