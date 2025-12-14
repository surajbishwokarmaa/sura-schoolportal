-- Create graduation status enum
CREATE TYPE public.graduation_status AS ENUM ('active', 'graduated', 'transferred', 'dropped');

-- Add graduation_status column to students table
ALTER TABLE public.students 
ADD COLUMN graduation_status public.graduation_status NOT NULL DEFAULT 'active';

-- Add school_level column to classes table to distinguish between levels
-- Level 1: Nursery to Grade 10
-- Level 2: Grade 11 and 12 (Higher Secondary)
ALTER TABLE public.classes 
ADD COLUMN school_level integer NOT NULL DEFAULT 1;

-- Create a function to determine if a class is a terminal class (requires graduation, not auto-upgrade)
CREATE OR REPLACE FUNCTION public.is_terminal_class(class_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_name IN ('Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12')
$$;

-- Create a function to get the next class for promotion (returns null for terminal classes)
CREATE OR REPLACE FUNCTION public.get_next_class(current_class text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Terminal classes - no auto-promotion
    WHEN current_class IN ('Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12') THEN NULL
    -- Pre-primary to primary progression
    WHEN current_class IN ('Nursery', 'nursery') THEN 'LKG'
    WHEN current_class IN ('LKG', 'lkg') THEN 'UKG'
    WHEN current_class IN ('UKG', 'ukg') THEN 'Grade 1'
    -- Standard grade progression (within same level)
    WHEN current_class IN ('Grade 1', 'Class 1', '1') THEN 'Grade 2'
    WHEN current_class IN ('Grade 2', 'Class 2', '2') THEN 'Grade 3'
    WHEN current_class IN ('Grade 3', 'Class 3', '3') THEN 'Grade 4'
    WHEN current_class IN ('Grade 4', 'Class 4', '4') THEN 'Grade 5'
    WHEN current_class IN ('Grade 5', 'Class 5', '5') THEN 'Grade 6'
    WHEN current_class IN ('Grade 6', 'Class 6', '6') THEN 'Grade 7'
    WHEN current_class IN ('Grade 7', 'Class 7', '7') THEN 'Grade 8'
    WHEN current_class IN ('Grade 8', 'Class 8', '8') THEN 'Grade 9'
    WHEN current_class IN ('Grade 9', 'Class 9', '9') THEN 'Grade 10'
    -- Grade 11 to 12 only (separate level, no cross-level promotion)
    WHEN current_class IN ('Grade 11', 'Class 11', '11') THEN 'Grade 12'
    ELSE NULL
  END
$$;