ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_roll_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS students_active_class_section_roll_uniq ON public.students(class, section, roll_no) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students(class, section);
CREATE INDEX IF NOT EXISTS idx_students_parent_phone ON public.students(parent_phone);

CREATE TABLE public.student_year_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  student_name text,
  action text NOT NULL,
  from_class text, to_class text,
  from_section text, to_section text,
  from_roll text, to_roll text,
  note text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_year_log TO authenticated;
GRANT ALL ON public.student_year_log TO service_role;
ALTER TABLE public.student_year_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view year log" ON public.student_year_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_year_log_created ON public.student_year_log(created_at DESC);

-- internal: renumber one section
CREATE OR REPLACE FUNCTION public._renumber_section(p_class text, p_section text, p_order text, p_uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _rn_old(id uuid, roll text) ON COMMIT DROP;
  DELETE FROM _rn_old;
  INSERT INTO _rn_old SELECT id, roll_no FROM students WHERE class = p_class AND section = p_section AND is_active = true;

  WITH o AS (
    SELECT id, row_number() OVER (
      ORDER BY
        CASE WHEN p_order = 'name' THEN lower(name) END,
        CASE WHEN p_order <> 'name' AND roll_no ~ '^[0-9]+$' THEN roll_no::int END NULLS LAST,
        CASE WHEN p_order <> 'name' THEN roll_no END,
        lower(name), id
    ) AS rn
    FROM students WHERE class = p_class AND section = p_section AND is_active = true
  )
  UPDATE students s SET roll_no = '~' || o.rn FROM o WHERE s.id = o.id;

  UPDATE students SET roll_no = substr(roll_no, 2), updated_at = now()
  WHERE class = p_class AND section = p_section AND is_active = true AND roll_no LIKE '~%';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO student_year_log(student_id, student_name, action, from_class, to_class, from_section, to_section, from_roll, to_roll, performed_by)
  SELECT s.id, s.name, 'roll_changed', s.class, s.class, s.section, s.section, o.roll, s.roll_no, p_uid
  FROM students s JOIN _rn_old o ON o.id = s.id WHERE o.roll IS DISTINCT FROM s.roll_no AND o.roll NOT LIKE '~%';
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public._renumber_section(text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- internal: next free roll in a section
CREATE OR REPLACE FUNCTION public._next_free_roll(p_class text, p_section text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (COALESCE(MAX(CASE WHEN roll_no ~ '^[0-9]+$' THEN roll_no::int END), 0) + 1)::text
  FROM students WHERE class = p_class AND section = p_section AND is_active = true
$$;
REVOKE ALL ON FUNCTION public._next_free_roll(text, text) FROM PUBLIC, anon, authenticated;

-- PUBLIC: renumber rolls
CREATE OR REPLACE FUNCTION public.renumber_rolls(p_class text DEFAULT NULL, p_section text DEFAULT NULL, p_order text DEFAULT 'name')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r record; v_total int := 0;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_order NOT IN ('name', 'current') THEN RAISE EXCEPTION 'Invalid order'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('student_year_ops'));
  FOR r IN SELECT DISTINCT class, section FROM students
           WHERE is_active = true AND (p_class IS NULL OR class = p_class) AND (p_section IS NULL OR section = p_section) LOOP
    v_total := v_total + _renumber_section(r.class, r.section, p_order, v_uid);
  END LOOP;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.renumber_rolls(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renumber_rolls(text, text, text) TO authenticated;

-- PUBLIC: promote students
CREATE OR REPLACE FUNCTION public.promote_students(p_mapping jsonb, p_hold_back uuid[] DEFAULT '{}', p_renumber boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_promoted int := 0; v_grad int := 0; v_held int := 0; r record; v_roll text;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_mapping) <> 'array' OR jsonb_array_length(p_mapping) = 0 OR jsonb_array_length(p_mapping) > 100 THEN
    RAISE EXCEPTION 'Invalid class mapping';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('student_year_ops'));

  CREATE TEMP TABLE IF NOT EXISTS _pmap(from_class text, to_class text) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _ptgt(id uuid, name text, class text, section text, roll text, to_class text, to_section text) ON COMMIT DROP;
  DELETE FROM _pmap; DELETE FROM _ptgt;

  INSERT INTO _pmap SELECT DISTINCT ON (e->>'from') e->>'from', NULLIF(e->>'to', '')
  FROM jsonb_array_elements(p_mapping) e WHERE COALESCE(e->>'from', '') <> '' AND COALESCE(e->>'to', '') <> 'skip';

  IF EXISTS (SELECT 1 FROM _pmap m WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.name = m.from_class))
     OR EXISTS (SELECT 1 FROM _pmap m WHERE m.to_class IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.name = m.to_class)) THEN
    RAISE EXCEPTION 'Mapping refers to a class that does not exist';
  END IF;

  INSERT INTO _ptgt
  SELECT s.id, s.name, s.class, s.section, s.roll_no, m.to_class,
    CASE WHEN m.to_class IS NULL THEN s.section
         WHEN s.section = ANY(COALESCE(c.sections, '{}')) THEN s.section
         ELSE COALESCE(c.sections[1], s.section) END
  FROM students s JOIN _pmap m ON m.from_class = s.class
  LEFT JOIN classes c ON c.name = m.to_class
  WHERE s.is_active = true AND s.graduation_status = 'active'
    AND NOT (s.id = ANY(COALESCE(p_hold_back, '{}')));

  SELECT count(*) INTO v_held FROM students s JOIN _pmap m ON m.from_class = s.class
  WHERE s.is_active = true AND s.id = ANY(COALESCE(p_hold_back, '{}'));

  -- graduates
  UPDATE students s SET graduation_status = 'graduated', is_active = false, updated_at = now()
  FROM _ptgt t WHERE s.id = t.id AND t.to_class IS NULL;
  GET DIAGNOSTICS v_grad = ROW_COUNT;

  -- promoted: phase 1 temporary roll to avoid collisions
  UPDATE students s SET roll_no = '~p' || s.id::text FROM _ptgt t WHERE s.id = t.id AND t.to_class IS NOT NULL;
  UPDATE students s SET class = t.to_class, section = t.to_section, updated_at = now()
  FROM _ptgt t WHERE s.id = t.id AND t.to_class IS NOT NULL;
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  IF p_renumber THEN
    UPDATE students s SET roll_no = '~' || lpad(t.roll, 10, '0') || s.id::text FROM _ptgt t WHERE s.id = t.id AND t.to_class IS NOT NULL;
    FOR r IN SELECT DISTINCT to_class, to_section FROM _ptgt WHERE to_class IS NOT NULL LOOP
      PERFORM _renumber_section(r.to_class, r.to_section, 'name', v_uid);
    END LOOP;
  ELSE
    FOR r IN SELECT * FROM _ptgt WHERE to_class IS NOT NULL ORDER BY to_class, to_section, roll LOOP
      IF EXISTS (SELECT 1 FROM students WHERE class = r.to_class AND section = r.to_section AND roll_no = r.roll AND is_active) THEN
        v_roll := _next_free_roll(r.to_class, r.to_section);
      ELSE v_roll := r.roll; END IF;
      UPDATE students SET roll_no = v_roll WHERE id = r.id;
    END LOOP;
  END IF;

  INSERT INTO student_year_log(student_id, student_name, action, from_class, to_class, from_section, to_section, from_roll, to_roll, performed_by)
  SELECT t.id, t.name, CASE WHEN t.to_class IS NULL THEN 'graduated' ELSE 'promoted' END,
         t.class, t.to_class, t.section, t.to_section, t.roll, s.roll_no, v_uid
  FROM _ptgt t JOIN students s ON s.id = t.id;

  INSERT INTO student_year_log(student_id, student_name, action, from_class, to_class, from_section, to_section, from_roll, to_roll, performed_by)
  SELECT s.id, s.name, 'held_back', s.class, s.class, s.section, s.section, s.roll_no, s.roll_no, v_uid
  FROM students s JOIN _pmap m ON m.from_class = s.class
  WHERE s.is_active = true AND s.id = ANY(COALESCE(p_hold_back, '{}'));

  RETURN jsonb_build_object('promoted', v_promoted, 'graduated', v_grad, 'held_back', v_held);
END $$;
REVOKE ALL ON FUNCTION public.promote_students(jsonb, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_students(jsonb, uuid[], boolean) TO authenticated;

-- PUBLIC: mark students left / rejoined
CREATE OR REPLACE FUNCTION public.set_students_status(p_ids uuid[], p_status graduation_status, p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_count int := 0; r record; v_roll text;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) > 5000 THEN RAISE EXCEPTION 'Invalid student list'; END IF;
  IF p_note IS NOT NULL AND length(p_note) > 500 THEN RAISE EXCEPTION 'Note too long'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('student_year_ops'));

  FOR r IN SELECT * FROM students WHERE id = ANY(p_ids) ORDER BY class, section, roll_no LOOP
    IF p_status = 'active' THEN
      IF r.is_active AND r.graduation_status = 'active' THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM students WHERE class = r.class AND section = r.section AND roll_no = r.roll_no AND is_active AND id <> r.id) THEN
        v_roll := _next_free_roll(r.class, r.section);
      ELSE v_roll := r.roll_no; END IF;
      UPDATE students SET is_active = true, graduation_status = 'active', roll_no = v_roll, updated_at = now() WHERE id = r.id;
      INSERT INTO student_year_log(student_id, student_name, action, from_class, to_class, from_section, to_section, from_roll, to_roll, note, performed_by)
      VALUES (r.id, r.name, 'rejoined', r.class, r.class, r.section, r.section, r.roll_no, v_roll, p_note, v_uid);
    ELSE
      IF NOT r.is_active AND r.graduation_status = p_status THEN CONTINUE; END IF;
      UPDATE students SET is_active = false, graduation_status = p_status, updated_at = now() WHERE id = r.id;
      INSERT INTO student_year_log(student_id, student_name, action, from_class, to_class, from_section, to_section, from_roll, to_roll, note, performed_by)
      VALUES (r.id, r.name, p_status::text, r.class, NULL, r.section, NULL, r.roll_no, NULL, p_note, v_uid);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.set_students_status(uuid[], graduation_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_students_status(uuid[], graduation_status, text) TO authenticated;

-- Login lookup uses the real account email so class/roll changes never break login
CREATE OR REPLACE FUNCTION public.get_student_login_info(parent_phone_input text)
RETURNS TABLE(student_email text, student_name text, roll_no text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(u.email::text,
      'student_' || regexp_replace(lower(s.class), '[^a-z0-9]', '', 'g') || '_' ||
      regexp_replace(s.roll_no, '[[:space:]]', '', 'g') || '@school.edu.np') AS student_email,
    s.name::text, s.roll_no::text
  FROM students s LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE regexp_replace(s.parent_phone, '[^0-9]', '', 'g') = regexp_replace(parent_phone_input, '[^0-9]', '', 'g')
    AND s.is_active = true AND s.user_id IS NOT NULL
  ORDER BY s.class, s.section, s.roll_no
  LIMIT 1;
END $$;