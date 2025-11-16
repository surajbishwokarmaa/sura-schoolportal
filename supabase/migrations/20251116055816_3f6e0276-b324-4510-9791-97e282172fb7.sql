-- Add academic year and exam management structure

-- Create academic_years table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_name TEXT NOT NULL UNIQUE, -- e.g., "2080-2081", "2081-2082"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create exam_types table (standardized exam periods)
CREATE TABLE IF NOT EXISTS public.exam_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "First Term", "Second Term", "Half-Yearly", "Final Exam"
  code TEXT NOT NULL UNIQUE, -- e.g., "first_term", "second_term", "half_yearly", "final"
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modify results table to include academic year
ALTER TABLE public.results 
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id),
  ADD COLUMN IF NOT EXISTS exam_type TEXT;

-- Enable RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for academic_years
CREATE POLICY "Everyone can view academic years"
  ON public.academic_years FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage academic years"
  ON public.academic_years FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for exam_types
CREATE POLICY "Everyone can view exam types"
  ON public.exam_types FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage exam types"
  ON public.exam_types FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Insert default exam types
INSERT INTO public.exam_types (name, code, display_order) VALUES
  ('First Term', 'first_term', 1),
  ('Second Term', 'second_term', 2),
  ('Half-Yearly', 'half_yearly', 3),
  ('Final Exam', 'final', 4)
ON CONFLICT (code) DO NOTHING;

-- Insert current academic year
INSERT INTO public.academic_years (year_name, start_date, end_date, is_current)
VALUES ('2081-2082', '2024-04-14', '2025-04-13', true)
ON CONFLICT (year_name) DO NOTHING;

-- Update trigger for academic_years
CREATE TRIGGER update_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_results_academic_year ON public.results(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_results_exam_type ON public.results(exam_type);