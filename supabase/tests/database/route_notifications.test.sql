-- Tests de integración del servicio de ruta (pickup/dropoff por hitos).
-- Corre con `supabase test db` (pgTAP). Todo dentro de una transacción que
-- termina en ROLLBACK: no deja rastro.
--
-- Cubre: create_daily_route, mark_route_stop_departed, complete_route_stop —
-- validación de geocodificación, aislamiento por organización y RLS por
-- chofer asignado (mismo criterio que welfare_check_entries/tasks).

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ─── Seed: 2 orgs, 2 choferes en org A, 3 clientes (2 geocodificados) ───────
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000a0001', 'admin-a@test.local'),
       ('00000000-0000-0000-0000-0000000b0001', 'admin-b@test.local'),
       ('00000000-0000-0000-0000-0000000d0001', 'driver-1@test.local'),
       ('00000000-0000-0000-0000-0000000d0002', 'driver-2@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000a000', 'Org A', 'test-route-org-a',
        '00000000-0000-0000-0000-0000000a0001', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-00000000b000', 'Org B', 'test-route-org-b',
        '00000000-0000-0000-0000-0000000b0001', 'active', now() + interval '1 year');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000a0001', 'admin'),
       ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000b0001', 'admin'),
       -- Los choferes son miembros (worker): las RPCs de ruta exigen org activa.
       ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000d0001', 'worker'),
       ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000d0002', 'worker');

insert into public.staff_members (id, organization_id, profile_id, first_name, last_name, email, role, specialty, is_active)
values ('00000000-0000-0000-0000-0000000fd001', '00000000-0000-0000-0000-00000000a000',
        '00000000-0000-0000-0000-0000000d0001', 'Chofer', 'Uno', 'driver-1@test.local', 'worker', 'driver', true),
       ('00000000-0000-0000-0000-0000000fd002', '00000000-0000-0000-0000-00000000a000',
        '00000000-0000-0000-0000-0000000d0002', 'Chofer', 'Dos', 'driver-2@test.local', 'worker', 'driver', true);

-- c1: geocodificado. c2: SIN geocodificar. c3: geocodificado (2da parada).
insert into public.customers (id, first_name, last_name, email, phone, organization_id, address, address_lat, address_lng)
values ('00000000-0000-0000-0000-0000000c0001', 'Cliente', 'Uno', 'c1@test.local', '555', '00000000-0000-0000-0000-00000000a000', 'Calle 1', 19.4326, -99.1332),
       ('00000000-0000-0000-0000-0000000c0002', 'Cliente', 'Dos', 'c2@test.local', '555', '00000000-0000-0000-0000-00000000a000', 'Calle 2', null, null),
       ('00000000-0000-0000-0000-0000000c0003', 'Cliente', 'Tres', 'c3@test.local', '555', '00000000-0000-0000-0000-00000000a000', 'Calle 3', 19.5, -99.2);

insert into public.dogs (id, customer_id, name, breed, organization_id)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000c0001', 'Firulais', 'Criollo', '00000000-0000-0000-0000-00000000a000'),
       ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000c0002', 'Toby', 'Criollo', '00000000-0000-0000-0000-00000000a000'),
       ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000c0003', 'Luna', 'Criollo', '00000000-0000-0000-0000-00000000a000');

insert into public.reservations (id, customer_id, dog_id, service_type, service_name, start_date, end_date, total_price, status, organization_id, pickup_requested)
values ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-00000000d001', 'daycare', 'Guardería', now(), now() + interval '8 hours', 100, 'scheduled', '00000000-0000-0000-0000-00000000a000', true),
       ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-00000000d002', 'daycare', 'Guardería', now(), now() + interval '8 hours', 100, 'scheduled', '00000000-0000-0000-0000-00000000a000', true),
       ('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000d003', 'daycare', 'Guardería', now(), now() + interval '8 hours', 100, 'scheduled', '00000000-0000-0000-0000-00000000a000', true);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ─── create_daily_route: falla si una reserva no está geocodificada ────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');

select throws_ok(
  $$select public.create_daily_route('00000000-0000-0000-0000-00000000a000', 'route_pickup',
      '00000000-0000-0000-0000-0000000fd001',
      array['00000000-0000-0000-0000-0000000e0002']::uuid[])$$,
  'El cliente de la reserva 00000000-0000-0000-0000-0000000e0002 no tiene dirección geocodificada'
);

-- Aislamiento: admin de la org B no puede crear rutas en la org A.
select pg_temp.act_as('00000000-0000-0000-0000-0000000b0001');
select throws_ok(
  $$select public.create_daily_route('00000000-0000-0000-0000-00000000a000', 'route_pickup',
      '00000000-0000-0000-0000-0000000fd001',
      array['00000000-0000-0000-0000-0000000e0001']::uuid[])$$,
  'No autorizado para crear rutas en esta organización'
);

-- ─── create_daily_route: crea task + N route_stops en el orden dado ────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');

create temp table t_route as
select public.create_daily_route(
  '00000000-0000-0000-0000-00000000a000', 'route_pickup',
  '00000000-0000-0000-0000-0000000fd001',
  array['00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0003']::uuid[]
) as id;

select is(
  (select type from public.tasks where id = (select id from t_route)),
  'route_pickup',
  'create_daily_route crea la task tipo route_pickup'
);

select is(
  (select count(*) from public.route_stops where task_id = (select id from t_route))::int,
  2,
  'create_daily_route crea una route_stop por reserva'
);

select is(
  (select reservation_id from public.route_stops
    where task_id = (select id from t_route) and sequence = 1),
  '00000000-0000-0000-0000-0000000e0001'::uuid,
  'la primera parada respeta el orden pasado por la UI'
);

create temp table t_stop1 as
select id from public.route_stops
  where task_id = (select id from t_route) and sequence = 1;
create temp table t_stop2 as
select id from public.route_stops
  where task_id = (select id from t_route) and sequence = 2;

-- ─── RLS / autorización: solo el chofer asignado (o scheduler) opera la parada ─
select pg_temp.act_as('00000000-0000-0000-0000-0000000d0002');
select throws_ok(
  format($f$select public.mark_route_stop_departed(%L)$f$, (select id from t_stop1)),
  'No autorizado para esta parada'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000d0001');
select lives_ok(
  format($f$select public.mark_route_stop_departed(%L)$f$, (select id from t_stop1)),
  'mark_route_stop_departed funciona para el chofer asignado'
);

select is(
  (select status from public.route_stops where id = (select id from t_stop1)),
  'en_route',
  'mark_route_stop_departed deja la parada en en_route'
);

-- Reintento (p.ej. falló el SMS): una segunda llamada en en_route se permite
-- y conserva el departed_at del primer intento.
create temp table t_departed as
select departed_at from public.route_stops where id = (select id from t_stop1);

select lives_ok(
  format($f$select public.mark_route_stop_departed(%L)$f$, (select id from t_stop1)),
  'reintentar la salida de una parada en en_route no falla'
);

select is(
  (select departed_at from public.route_stops where id = (select id from t_stop1)),
  (select departed_at from t_departed),
  'departed_at quedó fijado en el primer intento'
);

-- ─── complete_route_stop: cierra la task padre solo cuando ya no quedan paradas activas ─
select lives_ok(
  format($f$select public.complete_route_stop(%L)$f$, (select id from t_stop1)),
  'complete_route_stop funciona para el chofer asignado'
);

select is(
  (select status from public.tasks where id = (select id from t_route)),
  'pending',
  'la task padre NO se cierra mientras quede una parada activa'
);

-- El scheduler (admin) puede operar cualquier parada de su org, aunque no sea
-- el chofer asignado.
select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');
select lives_ok(
  format($f$select public.complete_route_stop(%L, 'no contestó')$f$, (select id from t_stop2)),
  'el scheduler puede completar/omitir cualquier parada de su org'
);

select is(
  (select status from public.route_stops where id = (select id from t_stop2)),
  'skipped',
  'complete_route_stop con motivo marca la parada como skipped'
);

select is(
  (select status from public.tasks where id = (select id from t_route)),
  'done',
  'la task padre se cierra cuando ya no quedan paradas activas'
);

select * from finish();
rollback;
