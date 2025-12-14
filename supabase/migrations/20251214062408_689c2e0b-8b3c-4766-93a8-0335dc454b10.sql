-- Add unique constraint on results to prevent duplicate term entries
-- This ensures only one result per student-subject-term-class combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique_entry 
ON public.results (student_id, subject, term, class);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_results_class_subject_term 
ON public.results (class, subject, term);