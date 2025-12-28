-- Add subject_type column to subjects table
ALTER TABLE public.subjects 
ADD COLUMN subject_type text NOT NULL DEFAULT 'compulsory' 
CHECK (subject_type IN ('compulsory', 'optional'));

-- Add comment for documentation
COMMENT ON COLUMN public.subjects.subject_type IS 'Type of subject: compulsory or optional';