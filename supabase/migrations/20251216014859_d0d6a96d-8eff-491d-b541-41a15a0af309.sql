-- Add display_order column to classes for proper sorting
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Insert standard classes with Lotus and Rose sections
INSERT INTO public.classes (name, sections, subjects, school_level, display_order) VALUES
  ('Nursery', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 1),
  ('LKG', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 2),
  ('UKG', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 3),
  ('Class 1', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 4),
  ('Class 2', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 5),
  ('Class 3', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 6),
  ('Class 4', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 7),
  ('Class 5', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 8),
  ('Class 6', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 9),
  ('Class 7', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 10),
  ('Class 8', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 11),
  ('Class 9', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 12),
  ('Class 10', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 1, 13)
ON CONFLICT DO NOTHING;