ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS designation text NOT NULL DEFAULT 'teacher';
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS class_teacher_class text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS class_teacher_section text;

CREATE OR REPLACE FUNCTION public.is_class_teacher_of(_class text, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = auth.uid()
    AND t.class_teacher_class = _class AND t.class_teacher_section = _section)
$$;

CREATE OR REPLACE FUNCTION public.can_view_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM students s WHERE s.id = _student_id AND (
    s.user_id = auth.uid() OR s.parent_phone = get_user_parent_phone(auth.uid())))
$$;

CREATE POLICY "Class teacher manages own section students" ON public.students
  FOR UPDATE TO authenticated
  USING (public.is_class_teacher_of(class, section))
  WITH CHECK (public.is_class_teacher_of(class, section));
CREATE POLICY "Class teacher views own section students" ON public.students
  FOR SELECT TO authenticated USING (public.is_class_teacher_of(class, section));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class text NOT NULL,
  section text NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present','absent','late','leave')),
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX attendance_class_date_idx ON public.attendance(class, section, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Class teacher manages attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_class_teacher_of(class, section)) WITH CHECK (public.is_class_teacher_of(class, section));
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.can_view_student(student_id));

CREATE TABLE public.fee_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date,
  bill_no text NOT NULL DEFAULT ('B' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fee_invoices_student_idx ON public.fee_invoices(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_invoices TO authenticated;
GRANT ALL ON public.fee_invoices TO service_role;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages invoices" ON public.fee_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students view own invoices" ON public.fee_invoices FOR SELECT TO authenticated
  USING (public.can_view_student(student_id));

CREATE TABLE public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.fee_invoices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  paid_on date NOT NULL DEFAULT current_date,
  receipt_no text NOT NULL DEFAULT ('R' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fee_payments_student_idx ON public.fee_payments(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages payments" ON public.fee_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students view own payments" ON public.fee_payments FOR SELECT TO authenticated
  USING (public.can_view_student(student_id));