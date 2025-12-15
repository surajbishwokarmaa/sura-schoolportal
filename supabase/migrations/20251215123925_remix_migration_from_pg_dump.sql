CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: graduation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.graduation_status AS ENUM (
    'active',
    'graduated',
    'transferred',
    'dropped'
);


--
-- Name: result_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.result_status AS ENUM (
    'pending',
    'approved',
    'published'
);


--
-- Name: student_gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.student_gender AS ENUM (
    'male',
    'female',
    'other'
);


--
-- Name: term_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.term_type AS ENUM (
    'first_term',
    'second_term',
    'third_term',
    'final_term'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'teacher',
    'student'
);


--
-- Name: auto_calculate_result(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_calculate_result() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  grade_result RECORD;
BEGIN
  -- Calculate total marks
  NEW.total_marks := COALESCE(NEW.theory_marks, 0) + COALESCE(NEW.practical_marks, 0);
  
  -- Get grade and GPA
  SELECT * INTO grade_result FROM public.calculate_grade_gpa(NEW.total_marks);
  NEW.grade := grade_result.grade;
  NEW.gpa := grade_result.gpa;
  
  RETURN NEW;
END;
$$;


--
-- Name: calculate_grade_gpa(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_grade_gpa(marks numeric) RETURNS TABLE(grade text, gpa numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN QUERY SELECT 
    CASE 
      WHEN marks >= 90 THEN 'A+'
      WHEN marks >= 80 THEN 'A'
      WHEN marks >= 70 THEN 'B+'
      WHEN marks >= 60 THEN 'B'
      WHEN marks >= 50 THEN 'C+'
      WHEN marks >= 40 THEN 'C'
      WHEN marks < 40 THEN 'NG'
      ELSE 'NG'
    END,
    CASE 
      WHEN marks >= 90 THEN 4.0
      WHEN marks >= 80 THEN 3.6
      WHEN marks >= 70 THEN 3.2
      WHEN marks >= 60 THEN 2.8
      WHEN marks >= 50 THEN 2.4
      WHEN marks >= 40 THEN 2.0
      WHEN marks < 40 THEN 0.8
      ELSE 0.8
    END;
END;
$$;


--
-- Name: check_password_reset_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_password_reset_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count requests from same phone in last hour
  SELECT COUNT(*) INTO recent_count
  FROM password_reset_requests
  WHERE parent_phone = NEW.parent_phone
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many password reset requests. Please try again later.';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: get_current_teacher_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_teacher_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
$$;


--
-- Name: get_next_class(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_class(current_class text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_student_login_info(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_student_login_info(parent_phone_input text) RETURNS TABLE(student_email text, student_name text, roll_no text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ('student' || s.roll_no || '@school.edu.np')::TEXT as student_email,
    s.name::TEXT as student_name,
    s.roll_no::TEXT as roll_no
  FROM students s
  WHERE s.parent_phone = parent_phone_input
    AND s.is_active = true
  LIMIT 1;
END;
$$;


--
-- Name: get_teacher_login_info(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_teacher_login_info(teacher_phone_input text) RETURNS TABLE(teacher_email text, teacher_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.email::TEXT as teacher_email,
    t.name::TEXT as teacher_name
  FROM teachers t
  WHERE t.phone = teacher_phone_input
  LIMIT 1;
END;
$$;


--
-- Name: get_user_parent_phone(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_parent_phone(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT parent_phone 
  FROM public.students 
  WHERE user_id = _user_id 
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.user_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.user_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_teacher_assigned_to_class_subject(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_teacher_assigned_to_class_subject(_class text, _subject text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.user_id = auth.uid()
      AND _class = ANY(t.classes_assigned)
      AND (
        _subject = ANY(t.subjects) 
        OR lower(_subject) = ANY(SELECT lower(s) FROM unnest(t.subjects) s)
      )
  )
$$;


--
-- Name: is_terminal_class(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_terminal_class(class_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT class_name IN ('Grade 10', 'Class 10', '10', 'Grade 12', 'Class 12', '12')
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    subjects jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sections text[] DEFAULT '{}'::text[],
    school_level integer DEFAULT 1 NOT NULL
);


--
-- Name: exam_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    parent_phone text NOT NULL,
    student_ids uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    expiry_date timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_auto_generated boolean DEFAULT false,
    visible_to text DEFAULT 'all'::text
);


--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_name text NOT NULL,
    roll_no text NOT NULL,
    class text NOT NULL,
    parent_phone text NOT NULL,
    email text,
    message text DEFAULT 'Forgot password request'::text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    phone text,
    role public.user_role NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.results (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    class text NOT NULL,
    subject text NOT NULL,
    term public.term_type NOT NULL,
    theory_marks numeric(5,2),
    practical_marks numeric(5,2),
    total_marks numeric(5,2),
    grade text,
    gpa numeric(3,2),
    status public.result_status DEFAULT 'pending'::public.result_status,
    teacher_id uuid,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id uuid,
    academic_year_id uuid,
    exam_type text
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    roll_no text NOT NULL,
    name text NOT NULL,
    class text NOT NULL,
    section text NOT NULL,
    dob date,
    gender public.student_gender,
    photo_url text,
    parent_name text,
    parent_phone text NOT NULL,
    address text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    graduation_status public.graduation_status DEFAULT 'active'::public.graduation_status NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    class_id uuid,
    theory_full_marks numeric DEFAULT 75 NOT NULL,
    practical_full_marks numeric DEFAULT 25 NOT NULL,
    total_marks numeric DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_equal_split boolean DEFAULT false
);


--
-- Name: system_guides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_guides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text,
    phone text,
    subjects text[] NOT NULL,
    classes_assigned text[] NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: academic_years academic_years_year_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_year_name_key UNIQUE (year_name);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: exam_types exam_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_types
    ADD CONSTRAINT exam_types_code_key UNIQUE (code);


--
-- Name: exam_types exam_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_types
    ADD CONSTRAINT exam_types_name_key UNIQUE (name);


--
-- Name: exam_types exam_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_types
    ADD CONSTRAINT exam_types_pkey PRIMARY KEY (id);


--
-- Name: families families_parent_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_parent_phone_key UNIQUE (parent_phone);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_roll_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_roll_no_key UNIQUE (roll_no);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: system_guides system_guides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_guides
    ADD CONSTRAINT system_guides_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_email_key UNIQUE (email);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_notices_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notices_created_at ON public.notices USING btree (created_at DESC);


--
-- Name: idx_notices_visible_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notices_visible_to ON public.notices USING btree (visible_to);


--
-- Name: idx_results_academic_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_results_academic_year ON public.results USING btree (academic_year_id);


--
-- Name: idx_results_class_subject_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_results_class_subject_term ON public.results USING btree (class, subject, term);


--
-- Name: idx_results_exam_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_results_exam_type ON public.results USING btree (exam_type);


--
-- Name: idx_results_unique_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_results_unique_entry ON public.results USING btree (student_id, subject, term, class);


--
-- Name: results calculate_result_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER calculate_result_trigger BEFORE INSERT OR UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_result();


--
-- Name: password_reset_requests password_reset_rate_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER password_reset_rate_limit_trigger BEFORE INSERT ON public.password_reset_requests FOR EACH ROW EXECUTE FUNCTION public.check_password_reset_rate_limit();


--
-- Name: academic_years update_academic_years_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: results update_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subjects update_subjects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_guides update_system_guides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_guides_updated_at BEFORE UPDATE ON public.system_guides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teachers update_teachers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notices notices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: results results_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- Name: results results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: results results_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- Name: results results_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id);


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: system_guides system_guides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_guides
    ADD CONSTRAINT system_guides_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: teachers teachers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: academic_years Admin can manage academic years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage academic years" ON public.academic_years USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: classes Admin can manage classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage classes" ON public.classes USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: exam_types Admin can manage exam types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage exam types" ON public.exam_types USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: notices Admin can manage notices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage notices" ON public.notices USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: password_reset_requests Admin can manage password reset requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage password reset requests" ON public.password_reset_requests USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: subjects Admin can manage subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage subjects" ON public.subjects USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: system_guides Admin can manage system guides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage system guides" ON public.system_guides USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: families Admin full access to families; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to families" ON public.families USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: results Admin full access to results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to results" ON public.results USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: students Admin full access to students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to students" ON public.students USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: teachers Admin full access to teachers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to teachers" ON public.teachers USING (public.has_role(auth.uid(), 'admin'::public.user_role));


--
-- Name: password_reset_requests Anyone can create password reset request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create password reset request" ON public.password_reset_requests FOR INSERT WITH CHECK (true);


--
-- Name: system_guides Authenticated users can view system guides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view system guides" ON public.system_guides FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: teachers Authenticated users can view teachers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view teachers" ON public.teachers FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: academic_years Everyone can view academic years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view academic years" ON public.academic_years FOR SELECT USING (true);


--
-- Name: classes Everyone can view classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view classes" ON public.classes FOR SELECT TO authenticated USING (true);


--
-- Name: exam_types Everyone can view exam types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view exam types" ON public.exam_types FOR SELECT USING (true);


--
-- Name: notices Everyone can view notices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view notices" ON public.notices FOR SELECT TO authenticated USING (true);


--
-- Name: families Parents can view own family; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parents can view own family" ON public.families FOR SELECT USING ((parent_phone IN ( SELECT students.parent_phone
   FROM public.students
  WHERE (students.user_id = auth.uid()))));


--
-- Name: students Students can view own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own record" ON public.students FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: results Students can view own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view own results" ON public.results FOR SELECT USING ((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.user_id = auth.uid()))));


--
-- Name: students Students can view siblings with same parent phone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view siblings with same parent phone" ON public.students FOR SELECT USING ((parent_phone = public.get_user_parent_phone(auth.uid())));


--
-- Name: results Teachers can delete own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can delete own results" ON public.results FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND (teacher_id = public.get_current_teacher_id())));


--
-- Name: results Teachers can insert results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can insert results" ON public.results FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND (teacher_id = public.get_current_teacher_id()) AND public.is_teacher_assigned_to_class_subject(class, subject)));


--
-- Name: results Teachers can update own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update own results" ON public.results FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND (teacher_id = public.get_current_teacher_id()))) WITH CHECK ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND (teacher_id = public.get_current_teacher_id())));


--
-- Name: results Teachers can view assigned results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view assigned results" ON public.results FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND public.is_teacher_assigned_to_class_subject(class, subject)));


--
-- Name: teachers Teachers can view own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view own record" ON public.teachers FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: subjects Teachers can view subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view subjects" ON public.subjects FOR SELECT USING ((public.has_role(auth.uid(), 'teacher'::public.user_role) OR public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'student'::public.user_role)));


--
-- Name: students Teachers view assigned students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view assigned students" ON public.students FOR SELECT USING ((public.has_role(auth.uid(), 'teacher'::public.user_role) AND (class IN ( SELECT unnest(teachers.classes_assigned) AS unnest
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid())))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: academic_years; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

--
-- Name: families; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

--
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: system_guides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_guides ENABLE ROW LEVEL SECURITY;

--
-- Name: teachers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


