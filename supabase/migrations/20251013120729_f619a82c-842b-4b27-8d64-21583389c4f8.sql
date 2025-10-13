-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE student_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE result_status AS ENUM ('pending', 'approved', 'published');
CREATE TYPE term_type AS ENUM ('first_term', 'second_term', 'third_term', 'final_term');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  section TEXT NOT NULL,
  dob DATE,
  gender student_gender,
  photo_url TEXT,
  parent_name TEXT,
  parent_phone TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  subjects TEXT[] NOT NULL,
  classes_assigned TEXT[] NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  subjects JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Results table
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  term term_type NOT NULL,
  theory_marks NUMERIC(5,2),
  practical_marks NUMERIC(5,2),
  total_marks NUMERIC(5,2),
  grade TEXT,
  gpa NUMERIC(3,2),
  status result_status DEFAULT 'pending',
  teacher_id UUID REFERENCES public.teachers(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, subject, term)
);

-- Notices table
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expiry_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Families table (for linking siblings)
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_phone TEXT NOT NULL UNIQUE,
  student_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for students (admin full access, teachers view, students view own)
CREATE POLICY "Admin full access to students" ON public.students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Teachers can view students" ON public.students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can view own record" ON public.students
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for teachers
CREATE POLICY "Admin full access to teachers" ON public.teachers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Teachers can view own record" ON public.teachers
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for classes
CREATE POLICY "Everyone can view classes" ON public.classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage classes" ON public.classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for results
CREATE POLICY "Admin full access to results" ON public.results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Teachers can manage own results" ON public.results
  FOR ALL USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Students can view own results" ON public.results
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- RLS Policies for notices
CREATE POLICY "Everyone can view notices" ON public.notices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage notices" ON public.notices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for families
CREATE POLICY "Admin full access to families" ON public.families
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Parents can view own family" ON public.families
  FOR SELECT USING (
    parent_phone IN (SELECT parent_phone FROM public.students WHERE user_id = auth.uid())
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate grade and GPA
CREATE OR REPLACE FUNCTION public.calculate_grade_gpa(marks NUMERIC)
RETURNS TABLE(grade TEXT, gpa NUMERIC) AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate grade and GPA on result insert/update
CREATE OR REPLACE FUNCTION public.auto_calculate_result()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_result_trigger BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_result();

-- Insert default classes with subjects
INSERT INTO public.classes (name, subjects) VALUES
('Nursery', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "GK": {"theory": 75, "practical": 25}}'::jsonb),
('LKG', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "GK": {"theory": 75, "practical": 25}}'::jsonb),
('UKG', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "GK": {"theory": 75, "practical": 25}}'::jsonb),
('Grade 1', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}}'::jsonb),
('Grade 2', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}}'::jsonb),
('Grade 3', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 4', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 5', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 6', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 7', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 8', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 9', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb),
('Grade 10', '{"English": {"theory": 75, "practical": 25}, "Math": {"theory": 75, "practical": 25}, "Science": {"theory": 75, "practical": 25}, "Social": {"theory": 75, "practical": 25}, "Nepali": {"theory": 75, "practical": 25}, "Computer": {"theory": 50, "practical": 50}}'::jsonb);