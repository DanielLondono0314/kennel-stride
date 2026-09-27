-- Tests de contratos (20260930000000_contracts). Corre con `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000ca01', 'admin-ca@test.local'),
       ('00000000-0000-0000-0000-00000000ca02', 'cajero-ca@test.local'),
       ('00000000-0000-0000-0000-00000000ca03', 'worker-ca@test.local'),
       ('00000000-0000-0000-0000-00000000cb01', 'admin-cb@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at, plan_tier)
values ('00000000-0000-0000-0000-00000000ca00', 'Org CA', 'test-contracts-a',
        '00000000-0000-0000-0000-00000000ca01', 'active', now() + interval '1 year', 'basic'),
       ('00000000-0000-0000-0000-00000000cb00', 'Org CB', 'test-contracts-b',
        '00000000-0000-0000-0000-00000000cb01', 'active', now() + interval '1 year', 'basic');

insert into public.org_roles (id, organization_id, name, access_type, permissions)
values ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-00000000ca00',
        'Cajero', 'panel', array['billing']);

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000ca01', 'admin'),
       ('00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000ca03', 'worker'),
       ('00000000-0000-0000-0000-00000000cb00', '00000000-0000-0000-0000-00000000cb01', 'admin');
insert into public.organization_members (organization_id, user_id, role_id)
values ('00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000ca02',
        '00000000-0000-0000-0000-00000000cc01');

insert into public.customers (id, organization_id, first_name, last_name, email, phone, id_document, data_consent_at)
values ('00000000-0000-0000-0000-00000000cd01', '00000000-0000-0000-0000-00000000ca00', 'Ana', 'Gómez', 'ana@test.local', '300', '1.020.304', now()),
       ('00000000-0000-0000-0000-00000000cd03', '00000000-0000-0000-0000-00000000ca00', 'Carlos', 'Paz', 'carlos@test.local', '302', null, now()),
       ('00000000-0000-0000-0000-00000000cd02', '00000000-0000-0000-0000-00000000cb00', 'Beto', 'Ruiz', 'beto@test.local', '301', '1020304', now());

insert into public.dogs (id, organization_id, customer_id, name, breed)
values ('00000000-0000-0000-0000-00000000cd11', '00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000cd01', 'Luna', 'Golden'),
       ('00000000-0000-0000-0000-00000000cd12', '00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000cd01', 'Max', 'Beagle'),
       ('00000000-0000-0000-0000-00000000cd13', '00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000cd03', 'Toby', 'Pug');

-- ─── Cédula ───────────────────────────────────────────────────────────────
select throws_ok(
  $$update public.customers set id_document = '1020304' where id = '00000000-0000-0000-0000-00000000cd03'$$,
  '23505', null, 'la misma cédula (sin puntos) no se repite en la org');
select lives_ok(
  $$update public.customers set id_document = '99.888' where id = '00000000-0000-0000-0000-00000000cd03'$$,
  'otra org puede tener la misma cédula; aquí una distinta pasa');

select throws_ok(
  $$update public.organizations set slug = 'firmar' where id = '00000000-0000-0000-0000-00000000cb00'$$,
  'Ese URL está reservado, elige otro', '"firmar" es un slug reservado (página pública de firma)');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- ─── Plantillas: solo admin escribe ───────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000ca01');
select lives_ok(
  $$insert into public.contract_templates (id, organization_id, name, service_type, body)
    values ('00000000-0000-0000-0000-00000000ce01', '00000000-0000-0000-0000-00000000ca00',
            'Guardería', 'daycare', 'Entre {{negocio_nombre}} y {{cliente_nombre}}')$$,
  'admin crea plantillas');

select pg_temp.act_as('00000000-0000-0000-0000-00000000ca02');
select throws_ok(
  $$insert into public.contract_templates (organization_id, name, body)
    values ('00000000-0000-0000-0000-00000000ca00', 'Mala', 'x')$$,
  '42501', null, 'cajero no crea plantillas');
select is((select count(*)::int from public.contract_templates), 1, 'cajero ve las plantillas de su org');

-- ─── Contratos con varios perros ──────────────────────────────────────────
select lives_ok(
  $$select public.create_contract(
      jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000ca00',
                         'template_id', '00000000-0000-0000-0000-00000000ce01',
                         'customer_id', '00000000-0000-0000-0000-00000000cd01',
                         'title', 'Guardería — Ana', 'body', 'Entre Org CA y Ana', 'total_value', 800000),
      array['00000000-0000-0000-0000-00000000cd11','00000000-0000-0000-0000-00000000cd12']::uuid[])$$,
  'cajero (billing) genera un contrato para dos perros');
select is((select count(*)::int from public.contract_dogs), 2, 'el contrato queda anexado a cada perro');

select throws_ok(
  $$select public.create_contract(
      jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000ca00',
                         'customer_id', '00000000-0000-0000-0000-00000000cd01', 'title', 'X', 'body', 'x'),
      array['00000000-0000-0000-0000-00000000cd13']::uuid[])$$,
  'El perro no pertenece al cliente del contrato',
  'no se anexa un perro de otro cliente');
select is((select count(*)::int from public.contracts), 1, 'el contrato fallido no deja rastro (atómico)');

select throws_ok(
  $$insert into public.contracts (organization_id, customer_id, title, body)
    values ('00000000-0000-0000-0000-00000000ca00', '00000000-0000-0000-0000-00000000cd02', 'X', 'x')$$,
  'Referencia inválida: customer_id no pertenece a esta organización',
  'no se puede usar un cliente de otra organización');

-- ─── El personal no fabrica firmas electrónicas ───────────────────────────
select throws_ok(
  $$update public.contracts set signature_image = 'data:image/png;base64,xx', signed_via = 'digital'$$,
  '42501', null, 'el personal no escribe la evidencia de firma');
select throws_ok(
  $$update public.contracts set status = 'sent'$$,
  'Cambio de estado no permitido', 'el personal no marca un contrato como enviado');

select pg_temp.act_as('00000000-0000-0000-0000-00000000ca03');
select is((select count(*)::int from public.contracts), 0, 'worker no ve contratos');
select is((select count(*)::int from public.contract_dogs), 0, 'worker no ve los anexos de perros');

select pg_temp.act_as('00000000-0000-0000-0000-00000000cb01');
select is((select count(*)::int from public.contracts), 0, 'otra org no ve contratos ajenos');

-- ─── Firmado en papel: inmutable salvo anular ─────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000ca02');
update public.contracts set status = 'signed';
select is((select signed_via from public.contracts), 'paper', 'marcar firmado lo registra como firma en papel');

select throws_ok(
  $$update public.contracts set status = 'generated'$$,
  'Un contrato firmado no se puede modificar, solo anular',
  'un contrato firmado no vuelve a pendiente');

delete from public.contracts;
select is((select count(*)::int from public.contracts), 1, 'cajero no puede borrar contratos');

update public.contracts set status = 'void';
select is((select status from public.contracts), 'void', 'un contrato firmado sí se puede anular');

select * from finish();
rollback;
