-- Tests de cumplimiento Ley 1581 (20260929000000_legal_consents).
-- Corre con `supabase test db` (pgTAP). Todo dentro de una transacción que
-- termina en ROLLBACK: no deja rastro.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ─── Registro: la aceptación viaja en los metadatos del signUp ─────────────
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000d001', 'nuevo@test.local',
        '{"full_name":"Nuevo","accepted_terms_version":"2026-09-29","accepted_privacy_version":"2026-09-29","accepted_user_agent":"pgtap"}'),
       ('00000000-0000-0000-0000-00000000d002', 'invitado@test.local', '{}'),
       ('00000000-0000-0000-0000-00000000d003', 'otro@test.local', '{}');

select is((select count(*)::int from public.legal_acceptances
           where user_id = '00000000-0000-0000-0000-00000000d001' and document in ('terms','privacy')), 2,
  'el signUp con aceptación deja prueba de Términos y Política');
select is((select count(*)::int from public.legal_acceptances
           where user_id = '00000000-0000-0000-0000-00000000d002'), 0,
  'sin aceptación en los metadatos no se inventa ninguna');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- ─── create_organization exige el Contrato de Transmisión ─────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$select public.create_organization('Centro Test', 'centro-legal-test')$$,
  'Debes aceptar el Contrato de Transmisión de Datos Personales para crear el centro',
  'no se crea un centro sin aceptar el contrato de transmisión'
);
select lives_ok(
  $$select public.create_organization('Centro Test', 'centro-legal-test', '2026-09-29')$$,
  'con la aceptación el centro se crea'
);
select is((select count(*)::int from public.legal_acceptances
           where user_id = '00000000-0000-0000-0000-00000000d001' and document = 'data_processing'
             and organization_id = (select id from public.organizations where slug = 'centro-legal-test')), 1,
  'queda prueba del contrato de transmisión ligada al centro');

-- Quien entró con Google (sin aceptación previa) la registra al crear el centro.
select pg_temp.act_as('00000000-0000-0000-0000-00000000d003');
select lives_ok(
  $$select public.create_organization('Centro Google', 'centro-google-test', '2026-09-29', '2026-09-29', '2026-09-29')$$,
  'usuario sin aceptación previa crea su centro aceptando todo'
);
select is((select count(*)::int from public.legal_acceptances
           where user_id = '00000000-0000-0000-0000-00000000d003'), 3,
  'se registran contrato, Términos y Política');

-- ─── accept_invitation exige aceptación si no la tenía ────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000d001');
insert into public.organization_invitations (organization_id, email, role, token)
values ((select id from public.organizations where slug = 'centro-legal-test'),
        'invitado@test.local', 'worker', 'tok-legal-test');

select pg_temp.act_as('00000000-0000-0000-0000-00000000d002');
select throws_ok(
  $$select public.accept_invitation('tok-legal-test')$$,
  'Debes aceptar los Términos y la Política de Tratamiento de Datos para unirte',
  'no se une sin aceptar los documentos'
);
select lives_ok(
  $$select public.accept_invitation('tok-legal-test', '2026-09-29', '2026-09-29')$$,
  'aceptando los documentos se une'
);

-- ─── Inmutabilidad y aislamiento ──────────────────────────────────────────
select is((select count(*)::int from public.legal_acceptances), 2,
  'cada usuario solo ve sus propias aceptaciones');

reset role;
select throws_ok(
  $$update public.legal_acceptances set version = 'x' where user_id = '00000000-0000-0000-0000-00000000d001'$$,
  'Las aceptaciones legales no se pueden modificar ni eliminar',
  'las aceptaciones son inmutables'
);
set local role authenticated;

-- ─── Autorización de clientes finales ─────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone, organization_id)
    values ('Sin', 'Autorizacion', 'sin@test.local', '555',
            (select id from public.organizations where slug = 'centro-legal-test'))$$,
  'Debes confirmar que el cliente autorizó el tratamiento de sus datos personales',
  'no se crea un cliente sin autorización'
);
insert into public.customers (id, first_name, last_name, email, phone, organization_id, data_consent_at)
values ('00000000-0000-0000-0000-00000000c0c1', 'Con', 'Autorizacion', 'con@test.local', '555',
        (select id from public.organizations where slug = 'centro-legal-test'), '2000-01-01');
select is((select data_consent_by from public.customers where id = '00000000-0000-0000-0000-00000000c0c1'),
          '00000000-0000-0000-0000-00000000d001'::uuid,
  'queda registrado quién confirmó la autorización');
select ok((select data_consent_at > now() - interval '1 minute' from public.customers
           where id = '00000000-0000-0000-0000-00000000c0c1'),
  'la fecha la fija el servidor, no el navegador');

select * from finish();
rollback;
