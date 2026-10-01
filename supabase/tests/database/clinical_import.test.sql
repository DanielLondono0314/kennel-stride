-- Importación de historia clínica: permisos, perros de otra org, duplicados
-- (contra lo existente y dentro del archivo), vista previa sin escribir y
-- que un peso viejo importado no pise el peso actual del perro.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000002a1', 'imp-admin-a@test.local'),
       ('00000000-0000-0000-0000-0000000002b1', 'imp-admin-b@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000020a', 'Imp Org A', 'imp-org-a',
        '00000000-0000-0000-0000-0000000002a1', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-00000000020b', 'Imp Org B', 'imp-org-b',
        '00000000-0000-0000-0000-0000000002b1', 'active', now() + interval '1 year');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-0000000002a1', 'admin'),
       ('00000000-0000-0000-0000-00000000020b', '00000000-0000-0000-0000-0000000002b1', 'admin');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000002c1', 'Dueño', 'Imp', 'imp@test.local', '555',
        '00000000-0000-0000-0000-00000000020a'),
       ('00000000-0000-0000-0000-0000000002c2', 'Dueño', 'B', 'impb@test.local', '556',
        '00000000-0000-0000-0000-00000000020b');

insert into public.dogs (id, customer_id, name, breed, weight, organization_id)
values ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002c1', 'Apolo', 'Criollo', 30,
        '00000000-0000-0000-0000-00000000020a'),
       ('00000000-0000-0000-0000-0000000002d2', '00000000-0000-0000-0000-0000000002c2', 'Ajeno', 'Criollo', 10,
        '00000000-0000-0000-0000-00000000020b');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table t_med as select jsonb_build_array(
  jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'record_date', '2026-03-01',
    'record_type', 'consultation', 'reason', 'Consulta general', 'diagnosis', 'Otitis', 'weight', 28,
    'notes', 'Origen: OkVet · Consulta #1'),
  -- misma consulta repetida en el archivo
  jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'record_date', '2026-03-01',
    'record_type', 'consultation', 'reason', 'Consulta general', 'diagnosis', 'Otitis', 'weight', 28,
    'notes', 'Origen: OkVet · Consulta #1'),
  -- mismo día, otra consulta: no es duplicado
  jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'record_date', '2026-03-01',
    'record_type', 'checkup', 'reason', 'Seguimiento', 'notes', 'Origen: OkVet · Consulta #2'),
  -- perro de otra organización
  jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d2', 'record_date', '2026-03-01',
    'reason', 'No debe entrar')
) as rows;

-- ─── Permisos ───────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000002b1');
select throws_ok(
  $$select public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'medical', (select rows from t_med))$$,
  'No tienes permiso para registrar historia clínica en esta organización'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a1');
select throws_ok(
  $$select public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'cirugias', '[]')$$,
  'Tipo de importación inválido: cirugias'
);

-- ─── Vista previa ───────────────────────────────────────────────────────────
select is(
  public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'medical', (select rows from t_med), true)::jsonb,
  '{"inserted": 2, "duplicates": 1, "invalid_dogs": 1, "dry_run": true}'::jsonb,
  'la vista previa cuenta nuevos, duplicados y perros ajenos'
);
select is(
  (select count(*)::int from public.medical_history where dog_id = '00000000-0000-0000-0000-0000000002d1'),
  0,
  'la vista previa no escribe nada'
);

-- ─── Importar ───────────────────────────────────────────────────────────────
select is(
  (public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'medical', (select rows from t_med)) ->> 'inserted')::int,
  2,
  'importa las consultas del perro de la organización'
);
select is(
  (select dog_name from public.medical_history where dog_id = '00000000-0000-0000-0000-0000000002d1' limit 1),
  'Apolo',
  'el nombre del perro sale de la base, no del archivo'
);
select is(
  (select count(*)::int from public.medical_history where dog_id = '00000000-0000-0000-0000-0000000002d2'),
  0,
  'no toca perros de otra organización'
);
select is(
  (public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'medical', (select rows from t_med)) ->> 'duplicates')::int,
  3,
  'reimportar el mismo archivo no duplica'
);

-- ─── Desparasitación y vacunas ──────────────────────────────────────────────
select is(
  public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'deworming', jsonb_build_array(
    jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'date_administered', '2026-03-05', 'product_name', 'Fenbendazol'),
    jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'date_administered', '2026-03-05', 'product_name', ' fenbendazol ')
  ))::jsonb ->> 'inserted',
  '1',
  'desparasitación: mismo producto y día cuenta una vez'
);
select is(
  public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'vaccines', jsonb_build_array(
    jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'date_administered', '2026-02-01',
      'vaccine_name', 'Rabia', 'next_dose_date', '2027-02-01')
  ))::jsonb ->> 'inserted',
  '1',
  'vacunas: se importa con su próxima dosis'
);

-- ─── Pesos ──────────────────────────────────────────────────────────────────
select is(
  public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'weights', jsonb_build_array(
    jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'recorded_at', '2026-03-01', 'weight', 28),
    jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'recorded_at', '2026-01-10', 'weight', 26.5, 'body_condition_score', 5)
  ))::jsonb - 'dry_run',
  '{"inserted": 1, "duplicates": 1, "invalid_dogs": 0}'::jsonb,
  'omite el peso que ya está en una consulta del mismo día'
);
select is(
  (select weight from public.dogs where id = '00000000-0000-0000-0000-0000000002d1'),
  30::numeric,
  'un peso viejo importado no pisa el peso actual de un perro sin pesadas'
);

-- Con pesadas previas manda la más reciente: una nueva importada sí actualiza.
select public.import_clinical_records('00000000-0000-0000-0000-00000000020a', 'weights', jsonb_build_array(
  jsonb_build_object('dog_id', '00000000-0000-0000-0000-0000000002d1', 'recorded_at', current_date::text, 'weight', 31)
));
select is(
  (select weight from public.dogs where id = '00000000-0000-0000-0000-0000000002d1'),
  31::numeric,
  'un peso importado más reciente que las pesadas existentes sí actualiza'
);

select ok(
  not has_function_privilege('anon', 'public.import_clinical_records(uuid, text, jsonb, boolean)', 'execute'),
  'anon no puede importar'
);

select * from finish();
rollback;
