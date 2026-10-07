-- Check-in de un perro que ya estaba en una perrera (ubicado antes de tener
-- reserva): se queda en ella o se mueve, sin quedar en dos perreras.

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005a1', 'ck-admin@test.local');
insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000050a', 'Ck Org', 'ck-org', '00000000-0000-0000-0000-0000000005a1', 'active', now() + interval '1 year');
insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a1', 'admin');
insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000005c1', 'Eva', 'Paz', 'eva@test.local', '555', '00000000-0000-0000-0000-00000000050a');
insert into public.dogs (id, customer_id, name, breed, organization_id) values
  ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005c1', 'Rex', 'Criollo', '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005d2', '00000000-0000-0000-0000-0000000005c1', 'Max', 'Criollo', '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005d3', '00000000-0000-0000-0000-0000000005c1', 'Sol', 'Criolla', '00000000-0000-0000-0000-00000000050a');
insert into public.facility_zones (id, name, organization_id) values ('00000000-0000-0000-0000-0000000005e0', 'Z', '00000000-0000-0000-0000-00000000050a');
-- K1: Rex ubicado a mano (sin reserva). K2: Max ubicado a mano. K3 y K4 libres.
insert into public.facility_units (id, zone_id, name, status, assigned_dog_id, assigned_dog_name, organization_id) values
  ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005e0', 'K1', 'occupied', '00000000-0000-0000-0000-0000000005d1', 'Rex', '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000005e0', 'K2', 'occupied', '00000000-0000-0000-0000-0000000005d2', 'Max', '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005f3', '00000000-0000-0000-0000-0000000005e0', 'K3', 'available', null, null, '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005f4', '00000000-0000-0000-0000-0000000005e0', 'K4', 'available', null, null, '00000000-0000-0000-0000-00000000050a');
insert into public.reservations (id, organization_id, customer_id, dog_id, service_type, service_name, status, start_date, end_date, total_price) values
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005d1', 'board', 'Internado', 'scheduled', now(), now() + interval '30 days', 0),
  ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005d2', 'board', 'Internado', 'scheduled', now(), now() + interval '30 days', 0),
  ('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005d1', 'board', 'Internado', 'scheduled', now(), now() + interval '30 days', 0),
  ('00000000-0000-0000-0000-0000000005b4', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005d3', 'board', 'Internado', 'scheduled', now(), now() + interval '30 days', 0);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000005a1', 'role', 'authenticated')::text, true);

-- 1. Rex se queda en su perrera (p_unit_id = la suya).
select lives_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005f1', '')$$,
  'check-in en la perrera donde el perro ya está'
);
select is((select assigned_reservation_id from public.facility_units where id = '00000000-0000-0000-0000-0000000005f1'),
  '00000000-0000-0000-0000-0000000005b1'::uuid, 'la perrera queda vinculada a la reserva');
select is((select status from public.reservations where id = '00000000-0000-0000-0000-0000000005b1'), 'checked_in',
  'la reserva queda en curso');

-- 2. Max se mueve a K3: K2 queda libre.
select lives_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000005f3', '')$$,
  'check-in moviendo al perro a otra perrera libre'
);
select is((select status from public.facility_units where id = '00000000-0000-0000-0000-0000000005f2'), 'available',
  'su perrera anterior queda libre');
select is((select count(*)::int from public.facility_units where assigned_dog_id = '00000000-0000-0000-0000-0000000005d2'), 1,
  'el perro nunca queda en dos perreras');

-- 3. Otra reserva de Rex mientras la primera sigue en curso: se bloquea.
select throws_like(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-0000000005f4', '')$$,
  'Este perro ya tiene otra estadía en curso en la perrera K1%',
  'no permite dos estadías en curso del mismo perro'
);

-- 4. Sol no está en ninguna perrera: se exige elegir una libre.
select throws_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b4', null, '')$$,
  'Elige una perrera para el check-in'
);
select throws_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b4', '00000000-0000-0000-0000-0000000005f1', '')$$,
  'Esa perrera no está disponible, elige otra',
  'no puede entrar a una perrera ocupada por otro perro'
);
select lives_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000005b4', '00000000-0000-0000-0000-0000000005f2', '')$$,
  'entra a la perrera que quedó libre'
);

select * from finish();
rollback;
