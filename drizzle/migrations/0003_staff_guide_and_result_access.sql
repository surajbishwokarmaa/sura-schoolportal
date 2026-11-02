DROP POLICY IF EXISTS "Authenticated users can view system guides" ON public.system_guides;
CREATE POLICY "Staff can view system guides" ON public.system_guides FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
REVOKE ALL ON public.system_guides FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_guides TO authenticated;
GRANT ALL ON public.system_guides TO service_role;
DROP POLICY IF EXISTS "Anyone can create password reset request" ON public.password_reset_requests;
CREATE POLICY "Public submits pending reset requests" ON public.password_reset_requests FOR INSERT TO anon, authenticated WITH CHECK (status='pending' AND admin_notes IS NULL AND resolved_at IS NULL AND resolved_by IS NULL AND created_at BETWEEN now()-interval '1 minute' AND now()+interval '1 minute' AND length(trim(student_name)) BETWEEN 1 AND 100 AND length(trim(roll_no)) BETWEEN 1 AND 20 AND length(trim(class)) BETWEEN 1 AND 50 AND parent_phone ~ '^[0-9]{10,15}$' AND length(coalesce(message,'')) <= 520 AND length(coalesce(email,'')) <= 255);
DROP POLICY IF EXISTS "Teachers can update own results" ON public.results;
CREATE POLICY "Teachers can update own results" ON public.results FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'teacher') AND teacher_id=public.get_current_teacher_id() AND public.is_teacher_assigned_to_class_subject(class,subject)) WITH CHECK (public.has_role(auth.uid(),'teacher') AND teacher_id=public.get_current_teacher_id() AND public.is_teacher_assigned_to_class_subject(class,subject));
DROP POLICY IF EXISTS "Students can view own results" ON public.results;
CREATE POLICY "Students can view own results" ON public.results FOR SELECT TO authenticated USING (status='approved' AND public.can_view_student(student_id));
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recent_count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('password-reset:' || NEW.parent_phone));
 SELECT count(*) INTO recent_count FROM public.password_reset_requests WHERE parent_phone=NEW.parent_phone AND created_at>now()-interval '1 hour';
 IF recent_count>=3 THEN RAISE EXCEPTION 'Too many password reset requests. Please try again later.'; END IF;
 RETURN NEW;
END; $$;