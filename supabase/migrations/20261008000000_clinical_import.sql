-- Importación de historia clínica desde otras plataformas (OkVet, etc.).
--
-- import_clinical_records(org, kind, rows, dry_run) recibe filas ya leídas y
-- emparejadas con un perro en el navegador, y en UNA transacción:
--   · descarta filas de perros que no son de la organización,
--   · omite duplicados (lo que ya existe y lo repetido dentro del archivo),
--     así que importar el mismo archivo dos veces no duplica nada,
--   · inserta el resto.
-- Con p_dry_run = true solo cuenta (vista previa), sin escribir.
--
-- Pesos: un peso viejo importado NO debe pisar el peso actual del perro (el
-- trigger sync_dog_weight_from_logs pone en dogs.weight el último registro).
-- Si el perro no tenía pesadas antes, se conserva su peso actual; si las
-- tenía, manda la más reciente (importada o no), como siempre. Además se
-- omite un peso que ya está en una consulta del mismo día (la hoja de pesos
-- lo mostraría dos veces).

CREATE INDEX IF NOT EXISTS idx_medical_history_dog_date      ON public.medical_history (dog_id, record_date);
CREATE INDEX IF NOT EXISTS idx_deworming_records_dog_date    ON public.deworming_records (dog_id, date_administered);
CREATE INDEX IF NOT EXISTS idx_vaccination_schedule_dog_date ON public.vaccination_schedule (dog_id, date_administered);

-- Texto comparable: sin espacios de más y en minúsculas.
CREATE OR REPLACE FUNCTION public.clinical_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.import_clinical_records(
  p_org_id  uuid,
  p_kind    text,
  p_rows    jsonb,
  p_dry_run boolean DEFAULT false
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          jsonb;
  v_dog      record;
  v_inserted integer := 0;
  v_dups     integer := 0;
  v_invalid  integer := 0;
  v_seen     text[] := '{}';
  v_key      text;
  v_date     date;
  v_weight   numeric;
  v_dogs_before jsonb := '{}'::jsonb;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_clinical_writer_org_ids()) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar historia clínica en esta organización';
  END IF;
  IF p_kind NOT IN ('medical', 'vaccines', 'deworming', 'weights') THEN
    RAISE EXCEPTION 'Tipo de importación inválido: %', p_kind;
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Las filas deben venir como una lista';
  END IF;
  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'Máximo 2000 filas por envío';
  END IF;

  -- Pesos: foto del estado antes de importar (¿tenía pesadas? ¿qué peso?).
  IF p_kind = 'weights' AND NOT p_dry_run THEN
    SELECT coalesce(jsonb_object_agg(d.id::text, jsonb_build_object(
             'weight', d.weight,
             'had_logs', EXISTS (SELECT 1 FROM public.dog_weight_logs l WHERE l.dog_id = d.id))), '{}'::jsonb)
      INTO v_dogs_before
      FROM public.dogs d
     WHERE d.organization_id = p_org_id
       AND d.id::text IN (SELECT x ->> 'dog_id' FROM jsonb_array_elements(p_rows) x);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    SELECT d.id, d.name INTO v_dog
      FROM public.dogs d
     WHERE d.id::text = r ->> 'dog_id' AND d.organization_id = p_org_id;
    IF v_dog.id IS NULL THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    IF p_kind = 'medical' THEN
      v_date := (r ->> 'record_date')::date;
      v_key := md5(concat_ws('|', v_dog.id, v_date,
        public.clinical_norm(r ->> 'reason'), public.clinical_norm(r ->> 'diagnosis'),
        public.clinical_norm(r ->> 'treatment'), public.clinical_norm(r ->> 'prescription'),
        public.clinical_norm(r ->> 'notes')));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.medical_history m
         WHERE m.dog_id = v_dog.id::text AND m.record_date = v_date
           AND public.clinical_norm(m.reason)       = public.clinical_norm(r ->> 'reason')
           AND public.clinical_norm(m.diagnosis)    = public.clinical_norm(r ->> 'diagnosis')
           AND public.clinical_norm(m.treatment)    = public.clinical_norm(r ->> 'treatment')
           AND public.clinical_norm(m.prescription) = public.clinical_norm(r ->> 'prescription')
           AND public.clinical_norm(m.notes)        = public.clinical_norm(r ->> 'notes')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.medical_history
          (dog_id, dog_name, organization_id, record_date, record_type, veterinarian, reason, diagnosis,
           treatment, prescription, weight, temperature, heart_rate, respiratory_rate, blood_pressure,
           body_condition_score, notes, next_appointment)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, v_date, coalesce(nullif(r ->> 'record_type', ''), 'consultation'),
           coalesce(r ->> 'veterinarian', ''), coalesce(r ->> 'reason', ''), coalesce(r ->> 'diagnosis', ''),
           coalesce(r ->> 'treatment', ''), coalesce(r ->> 'prescription', ''),
           (r ->> 'weight')::numeric, (r ->> 'temperature')::numeric, (r ->> 'heart_rate')::integer,
           (r ->> 'respiratory_rate')::integer, nullif(r ->> 'blood_pressure', ''),
           (r ->> 'body_condition_score')::integer, coalesce(r ->> 'notes', ''), (r ->> 'next_appointment')::date);
      END IF;

    ELSIF p_kind = 'deworming' THEN
      v_date := (r ->> 'date_administered')::date;
      v_key := concat_ws('|', v_dog.id, v_date, public.clinical_norm(r ->> 'product_name'));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.deworming_records x
         WHERE x.dog_id = v_dog.id::text AND x.date_administered = v_date
           AND public.clinical_norm(x.product_name) = public.clinical_norm(r ->> 'product_name')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.deworming_records
          (dog_id, dog_name, organization_id, product_name, product_type, date_administered,
           next_dose_date, weight_at_time, veterinarian, notes)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, r ->> 'product_name', coalesce(nullif(r ->> 'product_type', ''), 'internal'),
           v_date, (r ->> 'next_dose_date')::date, (r ->> 'weight_at_time')::numeric,
           coalesce(r ->> 'veterinarian', ''), coalesce(r ->> 'notes', ''));
      END IF;

    ELSIF p_kind = 'vaccines' THEN
      v_date := (r ->> 'date_administered')::date;
      v_key := concat_ws('|', v_dog.id, v_date, public.clinical_norm(r ->> 'vaccine_name'));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.vaccination_schedule x
         WHERE x.dog_id = v_dog.id::text AND x.date_administered = v_date
           AND public.clinical_norm(x.vaccine_name) = public.clinical_norm(r ->> 'vaccine_name')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.vaccination_schedule
          (dog_id, dog_name, organization_id, vaccine_name, vaccine_type, date_administered,
           next_dose_date, batch_number, veterinarian, status, notes)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, r ->> 'vaccine_name', coalesce(nullif(r ->> 'vaccine_type', ''), 'core'),
           v_date, (r ->> 'next_dose_date')::date, coalesce(r ->> 'batch_number', ''),
           coalesce(r ->> 'veterinarian', ''), 'administered', coalesce(r ->> 'notes', ''));
      END IF;

    ELSE -- weights
      v_date := (r ->> 'recorded_at')::date;
      v_weight := (r ->> 'weight')::numeric;
      v_key := concat_ws('|', v_dog.id, v_date, v_weight);
      IF v_key = ANY (v_seen)
         OR EXISTS (SELECT 1 FROM public.dog_weight_logs l
                     WHERE l.dog_id = v_dog.id AND l.recorded_at = v_date AND l.weight = v_weight)
         OR EXISTS (SELECT 1 FROM public.medical_history m
                     WHERE m.dog_id = v_dog.id::text AND m.record_date = v_date AND m.weight = v_weight)
      THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.dog_weight_logs (dog_id, organization_id, weight, recorded_at, notes, body_condition_score)
        VALUES (v_dog.id, p_org_id, v_weight, v_date, nullif(r ->> 'notes', ''), (r ->> 'body_condition_score')::smallint);
      END IF;
    END IF;

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Pesos: el perro que no tenía pesadas conserva su peso actual.
  IF p_kind = 'weights' AND NOT p_dry_run THEN
    UPDATE public.dogs d
       SET weight = (v_dogs_before -> d.id::text ->> 'weight')::numeric, updated_at = now()
     WHERE d.organization_id = p_org_id
       AND v_dogs_before ? d.id::text
       AND NOT (v_dogs_before -> d.id::text ->> 'had_logs')::boolean
       AND (v_dogs_before -> d.id::text ->> 'weight') IS NOT NULL
       AND d.weight IS DISTINCT FROM (v_dogs_before -> d.id::text ->> 'weight')::numeric;
  END IF;

  RETURN json_build_object('inserted', v_inserted, 'duplicates', v_dups, 'invalid_dogs', v_invalid, 'dry_run', p_dry_run);
END $$;

REVOKE EXECUTE ON FUNCTION public.import_clinical_records(uuid, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.import_clinical_records(uuid, text, jsonb, boolean) TO authenticated, service_role;
