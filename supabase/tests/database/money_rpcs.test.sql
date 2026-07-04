-- PR-11: tests de integración de los RPCs de dinero/cupos.
-- Corre con `supabase test db` (pgTAP). Todo dentro de una transacción
-- que termina en ROLLBACK: no deja rastro.
--
-- Cubre: create_reservation, check_in_reservation, deduct_package_credit,
-- complete_checkout — cambios de estado + aislamiento por organización.

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ─── Seed: 2 usuarios, 2 orgs, cliente/perro/perrera/paquete en org A ───────
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000a1', 'admin-a@test.local'),
       ('00000000-0000-0000-0000-0000000000b1', 'admin-b@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000000a', 'Org A', 'test-org-a',
        '00000000-0000-0000-0000-0000000000a1', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-00000000000b', 'Org B', 'test-org-b',
        '00000000-0000-0000-0000-0000000000b1', 'active', now() + interval '1 year');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'admin'),
       ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'admin');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000000c1', 'Cliente', 'Uno', 'c1@test.local', '555',
        '00000000-0000-0000-0000-00000000000a');

insert into public.dogs (id, customer_id, name, breed, organization_id)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1',
        'Firulais', 'Criollo', '00000000-0000-0000-0000-00000000000a');

insert into public.facility_zones (id, name, organization_id)
values ('00000000-0000-0000-0000-0000000000e0', 'Zona test', '00000000-0000-0000-0000-00000000000a');

insert into public.facility_units (id, zone_id, name, status, organization_id)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e0',
        'K-01', 'available', '00000000-0000-0000-0000-00000000000a');

insert into public.packages (id, customer_id, name, service_type, total_credits, remaining_credits,
                             status, expires_at, price, organization_id)
values ('00000000-0000-0000-0000-0000000000a9'::uuid, '00000000-0000-0000-0000-0000000000c1',
        'Bono x2', 'daycare', 2, 2, 'active', (now() + interval '90 days')::date, 100,
        '00000000-0000-0000-0000-00000000000a');

-- Helper: actuar como un usuario autenticado concreto.
create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ─── create_reservation ─────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

create temp table t_res as
select public.create_reservation(
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
  'daycare', 'Guardería', now(), now() + interval '8 hours', 100
) as id;

select is(
  (select status from public.reservations where id = (select id from t_res)),
  'requested',
  'create_reservation crea la reserva en estado requested'
);

select is(
  (select total_price from public.reservations where id = (select id from t_res)),
  100::numeric,
  'create_reservation guarda el precio'
);

select is(
  (select count(*) from public.notices
    where entity_type = 'reservation' and entity_id = (select id::text from t_res))::int,
  1,
  'create_reservation deja el notice en la misma transacción'
);

-- Doble booking del mismo perro en horario solapado → error.
select throws_ok(
  $$select public.create_reservation(
      '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
      'daycare', 'Guardería', now() + interval '1 hour', now() + interval '2 hours', 50)$$,
  'El perro ya tiene una reserva que se solapa en ese horario'
);

-- Aislamiento por org: el admin de la org B no puede reservar con cliente de A.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.create_reservation(
      '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
      'daycare', 'Guardería', now() + interval '2 days', now() + interval '2 days 8 hours', 50)$$,
  'Cliente inválido o fuera de tu organización'
);

-- ─── check_in_reservation ───────────────────────────────────────────────────
-- Aprobar la reserva (como haría el staff vía updateStatus).
update public.reservations set status = 'scheduled' where id = (select id from t_res);

-- La org B no puede hacer check-in de una reserva de la org A.
select throws_ok(
  format($f$select public.check_in_reservation(%L, '00000000-0000-0000-0000-0000000000f1', '')$f$,
         (select id from t_res)),
  'Reserva inválida, fuera de tu organización o no está aprobada'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  format($f$select public.check_in_reservation(%L, '00000000-0000-0000-0000-0000000000f1', 'entra bien')$f$,
         (select id from t_res)),
  'check_in_reservation funciona para la org dueña'
);

select is(
  (select status from public.reservations where id = (select id from t_res)),
  'checked_in',
  'check-in deja la reserva en checked_in'
);

select is(
  (select status from public.facility_units where id = '00000000-0000-0000-0000-0000000000f1'),
  'occupied',
  'check-in ocupa la perrera'
);

select is(
  (select assigned_reservation_id from public.facility_units
    where id = '00000000-0000-0000-0000-0000000000f1'),
  (select id from t_res),
  'check-in liga la perrera a la reserva'
);

-- Reserva ya en curso no se puede volver a check-in.
select throws_ok(
  format($f$select public.check_in_reservation(%L, '00000000-0000-0000-0000-0000000000f1', '')$f$,
         (select id from t_res)),
  'Reserva inválida, fuera de tu organización o no está aprobada'
);

-- ─── complete_checkout (efectivo) ───────────────────────────────────────────
-- La org B no puede hacer checkout de una reserva de la org A.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($f$select public.complete_checkout(%L, 'cash')$f$, (select id from t_res)),
  'Reserva inválida, fuera de tu organización o no está en curso'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

-- Método inválido → error (y no toca nada).
select throws_ok(
  format($f$select public.complete_checkout(%L, 'bitcoin')$f$, (select id from t_res)),
  'Método de pago inválido: bitcoin'
);

select lives_ok(
  format($f$select public.complete_checkout(%L, 'cash', null, 'todo bien')$f$, (select id from t_res)),
  'complete_checkout en efectivo funciona'
);

select is(
  (select status from public.reservations where id = (select id from t_res)),
  'completed',
  'checkout completa la reserva'
);

select is(
  (select count(*) from public.invoices
    where reservation_id = (select id::text from t_res) and status = 'paid' and total = 100)::int,
  1,
  'checkout en efectivo crea la factura pagada por el total'
);

select is(
  (select count(*) from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id
    where i.reservation_id = (select id::text from t_res))::int,
  1,
  'la factura lleva su línea de detalle'
);

select is(
  (select status from public.facility_units where id = '00000000-0000-0000-0000-0000000000f1'),
  'available',
  'checkout libera la perrera'
);

-- Doble checkout → error (la reserva ya no está en curso).
select throws_ok(
  format($f$select public.complete_checkout(%L, 'cash')$f$, (select id from t_res)),
  'Reserva inválida, fuera de tu organización o no está en curso'
);

-- ─── complete_checkout (paquete) + deduct_package_credit ────────────────────
-- Segunda reserva del mismo perro, sin solape, puesta en curso directamente.
insert into public.reservations (id, customer_id, dog_id, service_type, service_name,
                                 start_date, end_date, total_price, status, organization_id)
values ('00000000-0000-0000-0000-0000000000b9'::uuid, '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000d1', 'daycare', 'Guardería',
        now() + interval '7 days', now() + interval '7 days 8 hours', 100, 'checked_in',
        '00000000-0000-0000-0000-00000000000a');

-- deduct directo: 2 → 1 con log de auditoría.
select is(
  public.deduct_package_credit('00000000-0000-0000-0000-0000000000a9'::uuid, 'test'),
  1,
  'deduct_package_credit descuenta 2→1'
);

select is(
  (select count(*) from public.package_credit_log
    where package_id = '00000000-0000-0000-0000-0000000000a9'::uuid
      and credits_before = 2 and credits_after = 1)::int,
  1,
  'deduct_package_credit deja el log de auditoría'
);

-- Checkout con paquete: consume el último crédito y NO crea factura.
select lives_ok(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000000b9'::uuid, 'package',
                                    '00000000-0000-0000-0000-0000000000a9'::uuid)$$,
  'complete_checkout con paquete funciona'
);

select is(
  (select remaining_credits from public.packages
    where id = '00000000-0000-0000-0000-0000000000a9'::uuid),
  0,
  'el checkout con paquete consume el crédito (1→0)'
);

select is(
  (select count(*) from public.invoices
    where reservation_id = '00000000-0000-0000-0000-0000000000b9')::int,
  0,
  'el checkout con paquete NO crea factura'
);

-- El aislamiento del deduct: org B no puede descontar el paquete de A
-- (y además ya está agotado → mismo error de guardia).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.deduct_package_credit('00000000-0000-0000-0000-0000000000a9'::uuid, 'robo')$$,
  'Sin créditos disponibles o paquete inválido'
);

select * from finish();
rollback;
