-- Create storage buckets for student and teacher photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-photos', 'student-photos', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('teacher-photos', 'teacher-photos', true);

-- RLS policies for student photos
CREATE POLICY "Anyone can view student photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-photos');

CREATE POLICY "Admins can upload student photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);

CREATE POLICY "Admins can update student photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);

CREATE POLICY "Admins can delete student photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);

-- RLS policies for teacher photos
CREATE POLICY "Anyone can view teacher photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'teacher-photos');

CREATE POLICY "Admins can upload teacher photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'teacher-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);

CREATE POLICY "Admins can update teacher photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'teacher-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);

CREATE POLICY "Admins can delete teacher photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'teacher-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::user_role))
);