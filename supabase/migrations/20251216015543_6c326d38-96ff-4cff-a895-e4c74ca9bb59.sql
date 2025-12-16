-- Add Class 11 and Class 12 with Higher Secondary level (school_level = 2)
INSERT INTO public.classes (name, sections, subjects, school_level, display_order) VALUES
  ('Class 11', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 2, 14),
  ('Class 12', ARRAY['Lotus', 'Rose'], '{}'::jsonb, 2, 15)
ON CONFLICT DO NOTHING;