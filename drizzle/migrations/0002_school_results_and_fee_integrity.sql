ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS credit_hours numeric NOT NULL DEFAULT 1;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS theory_pass_percentage numeric NOT NULL DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS practical_pass_percentage numeric NOT NULL DEFAULT 0;
UPDATE public.subjects s SET theory_pass_percentage=35, practical_pass_percentage=40 FROM public.classes c WHERE c.id=s.class_id AND c.name IN ('Class 8','Class 10','Class 12');
ALTER TABLE public.subjects ADD CONSTRAINT subject_grading_config_valid CHECK (credit_hours > 0 AND theory_pass_percentage BETWEEN 0 AND 100 AND practical_pass_percentage BETWEEN 0 AND 100);
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS academic_year_bs text NOT NULL DEFAULT '';
UPDATE public.results r SET academic_year_bs=COALESCE((SELECT year_name FROM public.academic_years WHERE id=r.academic_year_id), (extract(year FROM r.created_at)::int + CASE WHEN extract(month FROM r.created_at)>=4 THEN 57 ELSE 56 END)::text) WHERE academic_year_bs='';
DROP INDEX IF EXISTS public.idx_results_unique_entry;
CREATE UNIQUE INDEX results_year_entry_unique ON public.results(student_id,subject,term,class,academic_year_bs);
CREATE INDEX IF NOT EXISTS results_roster_year_idx ON public.results(class,term,academic_year_bs,student_id);
CREATE INDEX IF NOT EXISTS students_active_section_idx ON public.students(class,section,is_active,id);
CREATE INDEX IF NOT EXISTS fee_payments_invoice_idx ON public.fee_payments(invoice_id);

CREATE OR REPLACE FUNCTION public.calculate_grade_gpa(marks numeric) RETURNS TABLE(grade text,gpa numeric) LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN marks>=90 THEN 'A+' WHEN marks>=80 THEN 'A' WHEN marks>=70 THEN 'B+' WHEN marks>=60 THEN 'B' WHEN marks>=50 THEN 'C+' WHEN marks>=40 THEN 'C' WHEN marks>=35 THEN 'D' ELSE 'NG' END,
 CASE WHEN marks>=90 THEN 4.0 WHEN marks>=80 THEN 3.6 WHEN marks>=70 THEN 3.2 WHEN marks>=60 THEN 2.8 WHEN marks>=50 THEN 2.4 WHEN marks>=40 THEN 2.0 WHEN marks>=35 THEN 1.6 ELSE 0 END::numeric;
$$;
CREATE OR REPLACE FUNCTION public.auto_calculate_result() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.subjects; g record;
BEGIN
 SELECT sub.* INTO s FROM public.subjects sub JOIN public.classes c ON c.id=sub.class_id WHERE c.name=NEW.class AND (sub.id=NEW.subject_id OR (NEW.subject_id IS NULL AND lower(sub.name)=lower(NEW.subject))) ORDER BY sub.id LIMIT 1;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Configure this subject for the class before entering results'; END IF;
 IF NEW.theory_marks IS NULL OR NEW.practical_marks IS NULL OR NEW.theory_marks<0 OR NEW.practical_marks<0 OR NEW.theory_marks>s.theory_full_marks OR NEW.practical_marks>s.practical_full_marks OR s.total_marks<=0 THEN RAISE EXCEPTION 'Marks must be within the subject component limits'; END IF;
 NEW.subject_id:=s.id;
 IF NEW.academic_year_bs='' THEN NEW.academic_year_bs:=(extract(year FROM now())::int+CASE WHEN extract(month FROM now())>=4 THEN 57 ELSE 56 END)::text; END IF;
 NEW.total_marks:=NEW.theory_marks+NEW.practical_marks;
 SELECT * INTO g FROM public.calculate_grade_gpa(NEW.total_marks/s.total_marks*100);
 NEW.grade:=g.grade; NEW.gpa:=g.gpa;
 IF (s.theory_full_marks>0 AND NEW.theory_marks/s.theory_full_marks*100<s.theory_pass_percentage) OR (s.practical_full_marks>0 AND NEW.practical_marks/s.practical_full_marks*100<s.practical_pass_percentage) THEN NEW.grade:='NG'; NEW.gpa:=0; END IF;
 RETURN NEW;
END; $$;
CREATE POLICY "Class teacher reads section results" ON public.results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id=results.student_id AND s.class=results.class AND public.is_class_teacher_of(s.class,s.section)));

CREATE OR REPLACE FUNCTION public.validate_fee_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE bill public.fee_invoices; paid numeric;
BEGIN
 IF TG_OP='UPDATE' AND NEW.invoice_id<>OLD.invoice_id THEN RAISE EXCEPTION 'A payment cannot be moved to another bill'; END IF;
 SELECT * INTO bill FROM public.fee_invoices WHERE id=NEW.invoice_id FOR UPDATE;
 IF bill.id IS NULL OR bill.student_id<>NEW.student_id THEN RAISE EXCEPTION 'Payment student must match the bill'; END IF;
 IF NEW.amount<=0 OR NEW.amount IS NULL OR NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a positive finite payment amount'; END IF;
 SELECT COALESCE(sum(amount),0) INTO paid FROM public.fee_payments WHERE invoice_id=NEW.invoice_id AND id<>NEW.id;
 IF paid+NEW.amount>bill.amount THEN RAISE EXCEPTION 'Payment exceeds the outstanding balance'; END IF;
 IF NEW.method NOT IN ('cash','bank','esewa','khalti') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_fee_payment BEFORE INSERT OR UPDATE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.validate_fee_payment();
CREATE OR REPLACE FUNCTION public.add_section_fee(p_class text,p_section text,p_student_id uuid,p_title text,p_amount numeric,p_due date,p_batch uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF p_amount<=0 OR p_amount>10000000 OR p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR length(trim(p_title))=0 OR length(p_title)>120 THEN RAISE EXCEPTION 'Enter a valid title and amount'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_batch::text,0));
 IF EXISTS (SELECT 1 FROM public.fee_invoices WHERE notes='batch:'||p_batch::text) THEN RETURN 0; END IF;
 INSERT INTO public.fee_invoices(student_id,title,amount,due_date,created_by,notes)
 SELECT id,trim(p_title),p_amount,p_due,auth.uid(),'batch:'||p_batch::text FROM public.students WHERE class=p_class AND section=p_section AND is_active=true AND (p_student_id IS NULL OR id=p_student_id);
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected=0 THEN RAISE EXCEPTION 'No matching active students'; END IF;
 RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.add_section_fee(text,text,uuid,text,numeric,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_section_fee(text,text,uuid,text,numeric,date,uuid) TO authenticated,service_role;