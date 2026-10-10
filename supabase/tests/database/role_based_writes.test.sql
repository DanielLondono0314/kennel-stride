-- Escrituras según el rol: un trabajador no borra perros ni edita clientes,
-- recepción no borra, solo quien tiene "Borrar clientes y perros" borra, y los
-- avisos solo se marcan leídos/descartados.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'rw-admin@test.local'),
  ('00000000-0000-0000-0000-0000000004a2', 'rw-worker@test.local'),
  ('00000000-0000-0000-0000-0000000004a3', 'rw-front@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000040a', 'RW Org', 'rw-org', '00000000-0000-0000-0000-0000000004a1', 'active', now() + interval '1 year');

-- Roles: el trigger de la org crea los de sistema; se agregan dos propios.
insert into public.org_roles (id, organization_id, name, access_type, permissions) values
  ('00000000-0000-0000-0000-0000000004b2', '00000000-0000-0000-0000-00000000040a', 'Trabajador prueba', 'worker',
   array['dogs.create', 'dogs.edit', 'clinical.edit', 'clinical.import', 'weight.record', 'weight.edit',
         'welfare.configure', 'report_cards.write', 'facility.manage', 'kennels.assign', 'kennels.move']),
  ('00000000-0000-0000-0000-0000000004b3', '00000000-0000-0000-0000-00000000040a', 'Recepción prueba', 'panel',
   array['reservations.create', 'reservations.edit', 'stays.checkin', 'stays.checkout', 'facility.manage',
         'kennels.assign', 'customers.create', 'customers.edit', 'dogs.create', 'dogs.edit',
         'invoices.create', 'invoices.payment', 'weight.record']);

insert into public.organization_members (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000040a', '00000000-0000-0000-0000-0000000004a1', 'admin');
insert into public.organization_members (organization_id, user_id, role_id) values
  ('00000000-0000-0000-0000-00000000040a', '00000000-0000-0000-0000-0000000004a2', '00000000-0000-0000-0000-0000000004b2'),
  ('00000000-0000-0000-0000-00000000040a', '00000000-0000-0000-0000-0000000004a3', '00000000-0000-0000-0000-0000000004b3');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000004c1', 'Ana', 'Ruiz', 'ana-rw@test.local', '555', '00000000-0000-0000-0000-00000000040a');
insert into public.dogs (id, customer_id, name, breed, organization_id)
values ('00000000-0000-0000-0000-0000000004d1', '00000000-0000-0000-0000-0000000004c1', 'Bruno', 'Criollo', '00000000-0000-0000-0000-00000000040a');
insert into public.notices (id, organization_id, title, message)
values ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-00000000040a', 'Aviso', 'Texto original');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- ─── Trabajador (clínica, perreras, peso) ───────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a2');

select lives_ok(
  $$update public.dogs set medical_notes = 'Revisado' where id = '00000000-0000-0000-0000-0000000004d1'$$,
  'trabajador con permiso clínico actualiza datos del perro'
);
delete from public.dogs where id = '00000000-0000-0000-0000-0000000004d1';
select is((select count(*)::int from public.dogs where id = '00000000-0000-0000-0000-0000000004d1'), 1,
  'trabajador NO puede borrar perros');
update public.customers set phone = '999' where id = '00000000-0000-0000-0000-0000000004c1';
select is((select phone from public.customers where id = '00000000-0000-0000-0000-0000000004c1'), '555',
  'trabajador NO puede editar clientes');
select throws_ok(
  $$insert into public.campaigns (organization_id, name) values ('00000000-0000-0000-0000-00000000040a', 'X')$$,
  '42501', null, 'trabajador NO puede crear campañas'
);
select lives_ok(
  $$insert into public.notices (organization_id, title, message) values ('00000000-0000-0000-0000-00000000040a', 'Ronda', 'Novedad')$$,
  'trabajador sí crea avisos (rondas de bienestar)'
);
select lives_ok(
  $$update public.notices set is_read = true where id = '00000000-0000-0000-0000-0000000004e1'$$,
  'cualquier miembro marca un aviso como leído'
);
select throws_ok(
  $$update public.notices set message = 'Cambiado' where id = '00000000-0000-0000-0000-0000000004e1'$$,
  '42501', null, 'nadie reescribe el texto de un aviso'
);
select lives_ok(
  $$insert into public.dog_weight_logs (dog_id, organization_id, weight) values ('00000000-0000-0000-0000-0000000004d1', '00000000-0000-0000-0000-00000000040a', 20)$$,
  'trabajador con permiso de peso registra pesos'
);

-- ─── Recepción (agendar, cobrar, peso) ──────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a3');

update public.customers set phone = '777' where id = '00000000-0000-0000-0000-0000000004c1';
select is((select phone from public.customers where id = '00000000-0000-0000-0000-0000000004c1'), '777',
  'recepción edita clientes');
delete from public.customers where id = '00000000-0000-0000-0000-0000000004c1';
select is((select count(*)::int from public.customers where id = '00000000-0000-0000-0000-0000000004c1'), 1,
  'recepción NO puede borrar clientes (sin permiso de borrar)');
delete from public.notices where id = '00000000-0000-0000-0000-0000000004e1';
select is((select count(*)::int from public.notices where id = '00000000-0000-0000-0000-0000000004e1'), 1,
  'recepción NO borra avisos');
select lives_ok(
  $$insert into public.facility_zones (organization_id, name) values ('00000000-0000-0000-0000-00000000040a', 'Zona R')$$,
  'recepción (agendar) puede crear zonas para asignar perreras'
);

-- ─── Administrador ──────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1');
delete from public.dogs where id = '00000000-0000-0000-0000-0000000004d1';
select is((select count(*)::int from public.dogs where id = '00000000-0000-0000-0000-0000000004d1'), 0,
  'administrador sí borra perros');
delete from public.notices where id = '00000000-0000-0000-0000-0000000004e1';
select is((select count(*)::int from public.notices where id = '00000000-0000-0000-0000-0000000004e1'), 0,
  'administrador sí borra avisos');

reset role;
select * from finish();
rollback;
