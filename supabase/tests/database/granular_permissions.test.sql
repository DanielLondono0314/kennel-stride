-- Tests de permisos detallados (20261017000000_granular_permissions).
-- Cada acción exige su propio permiso: mover un perro de perrera no exige
-- poder hacer check-in, aprobar no es cancelar, cobrar no es anular, etc.
-- Corre con `supabase test db` (pgTAP). Todo termina en ROLLBACK.

begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ─── Seed ──────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'admin@gp.local'),
  ('00000000-0000-0000-0000-0000000005a2', 'mover@gp.local'),
  ('00000000-0000-0000-0000-0000000005a3', 'operar@gp.local'),
  ('00000000-0000-0000-0000-0000000005a4', 'aprobar@gp.local'),
  ('00000000-0000-0000-0000-0000000005a5', 'cancelar@gp.local'),
  ('00000000-0000-0000-0000-0000000005a6', 'editar@gp.local'),
  ('00000000-0000-0000-0000-0000000005a7', 'cobrar@gp.local'),
  ('00000000-0000-0000-0000-0000000005a8', 'anular@gp.local'),
  ('00000000-0000-0000-0000-0000000005a9', 'vet@gp.local'),
  ('00000000-0000-0000-0000-0000000005aa', 'peso@gp.local'),
  ('00000000-0000-0000-0000-0000000005ab', 'checkout@gp.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at, plan_tier)
values ('00000000-0000-0000-0000-00000000050a', 'GP Org', 'gp-org',
        '00000000-0000-0000-0000-0000000005a1', 'active', now() + interval '1 year', 'premium');

insert into public.org_roles (id, organization_id, name, access_type, permissions) values
  ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-00000000050a', 'Mover', 'worker', array['kennels.move']),
  ('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-00000000050a', 'Operar', 'worker', array['kennels.assign']),
  ('00000000-0000-0000-0000-0000000005b4', '00000000-0000-0000-0000-00000000050a', 'Aprobar', 'panel', array['reservations.approve']),
  ('00000000-0000-0000-0000-0000000005b5', '00000000-0000-0000-0000-00000000050a', 'Cancelar', 'panel', array['reservations.cancel']),
  ('00000000-0000-0000-0000-0000000005b6', '00000000-0000-0000-0000-00000000050a', 'Editar', 'panel', array['reservations.edit']),
  ('00000000-0000-0000-0000-0000000005b7', '00000000-0000-0000-0000-00000000050a', 'Cobrar', 'panel', array['invoices.payment']),
  ('00000000-0000-0000-0000-0000000005b8', '00000000-0000-0000-0000-00000000050a', 'Anular', 'panel', array['invoices.cancel']),
  ('00000000-0000-0000-0000-0000000005ba', '00000000-0000-0000-0000-00000000050a', 'Peso', 'worker', array['weight.record']),
  ('00000000-0000-0000-0000-0000000005bb', '00000000-0000-0000-0000-00000000050a', 'Checkout', 'worker', array['stays.checkout', 'plans.use']);

insert into public.organization_members (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a1', 'admin');
insert into public.organization_members (organization_id, user_id, role_id) values
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005b2'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000005b3'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a4', '00000000-0000-0000-0000-0000000005b4'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a5', '00000000-0000-0000-0000-0000000005b5'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a6', '00000000-0000-0000-0000-0000000005b6'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a7', '00000000-0000-0000-0000-0000000005b7'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a8', '00000000-0000-0000-0000-0000000005b8'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a9', '00000000-0000-0000-0000-0000000005ba'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-0000000005ba'),
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005ab', '00000000-0000-0000-0000-0000000005bb');

-- El veterinario tiene el mismo rol que "Peso", pero su especialidad le da la clínica.
insert into public.staff_members (id, organization_id, profile_id, first_name, last_name, email, role_id, specialty) values
  ('00000000-0000-0000-0000-0000000005f9', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005a9',
   'Vera', 'Vet', 'vet@gp.local', '00000000-0000-0000-0000-0000000005ba', 'vet'),
  ('00000000-0000-0000-0000-0000000005fa', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005aa',
   'Pedro', 'Peso', 'peso@gp.local', '00000000-0000-0000-0000-0000000005ba', null);

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000005c1', 'Ana', 'Ruiz', 'ana-gp@test.local', '555', '00000000-0000-0000-0000-00000000050a');
insert into public.dogs (id, customer_id, name, breed, organization_id) values
  ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005c1', 'Bruno', 'Criollo', '00000000-0000-0000-0000-00000000050a'),
  ('00000000-0000-0000-0000-0000000005d2', '00000000-0000-0000-0000-0000000005c1', 'Luna', 'Criolla', '00000000-0000-0000-0000-00000000050a');

insert into public.facility_zones (id, organization_id, name)
values ('00000000-0000-0000-0000-0000000005e0', '00000000-0000-0000-0000-00000000050a', 'Zona');
insert into public.facility_units (id, organization_id, zone_id, name, status, assigned_dog_id, assigned_dog_name) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005e0',
   'K-01', 'occupied', '00000000-0000-0000-0000-0000000005d1', 'Bruno'),
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005e0',
   'K-02', 'available', null, null);

insert into public.reservations (id, organization_id, customer_id, dog_id, service_type, service_name,
                                 start_date, end_date, total_price, status) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1',
   '00000000-0000-0000-0000-0000000005d2', 'daycare', 'Guardería', now() + interval '1 day', now() + interval '1 day 8 hours', 100, 'requested'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1',
   '00000000-0000-0000-0000-0000000005d2', 'daycare', 'Guardería', now() + interval '2 days', now() + interval '2 days 8 hours', 100, 'scheduled'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1',
   '00000000-0000-0000-0000-0000000005d2', 'daycare', 'Guardería', now() + interval '3 days', now() + interval '3 days 8 hours', 100, 'scheduled'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005c1',
   '00000000-0000-0000-0000-0000000005d1', 'daycare', 'Guardería', now() - interval '2 hours', now() + interval '6 hours', 100, 'checked_in');

insert into public.invoices (id, organization_id, customer_id, status, subtotal, total)
values ('00000000-0000-0000-0000-0000000005c9', '00000000-0000-0000-0000-00000000050a',
        '00000000-0000-0000-0000-0000000005c1', 'pending', 100, 100);

insert into public.medical_history (organization_id, dog_id, dog_name, notes)
values ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005d1', 'Bruno', 'Control anual');

insert into public.tasks (organization_id, type, title, assignee_staff_id) values
  ('00000000-0000-0000-0000-00000000050a', 'feeding', 'Comida de Pedro', '00000000-0000-0000-0000-0000000005fa'),
  ('00000000-0000-0000-0000-00000000050a', 'cleaning', 'Limpieza general', null);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

select ok(public.org_permission_implied(array['invoices.create']) @> array['invoices.view', 'prices.view'],
  'los permisos implícitos son transitivos (facturar → ver facturas → ver precios)');

-- Como la app: las guardas revisan las escrituras directas del rol authenticated.
set local role authenticated;

-- ─── Perreras ──────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a2');
select lives_ok(
  $$select public.move_dog_kennel('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005e2')$$,
  'con solo "mover perros" se cambia un perro de perrera'
);
select throws_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000005e1', '')$$,
  'Reserva inválida, fuera de tu organización o no está aprobada',
  'mover perros no da permiso de check-in'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a3');
select lives_ok(
  $$update public.facility_units set status = 'maintenance' where id = '00000000-0000-0000-0000-0000000005e1'$$,
  'operar perreras permite marcar mantenimiento'
);
select throws_ok(
  $$update public.facility_units set name = 'Renombrada' where id = '00000000-0000-0000-0000-0000000005e1'$$,
  'No tienes permiso para configurar perreras',
  'operar perreras no permite renombrarlas'
);
select throws_ok(
  $$insert into public.facility_units (organization_id, zone_id, name)
    values ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-0000000005e0', 'K-99')$$,
  '42501', null, 'operar perreras no permite crearlas'
);

-- ─── Reservas: aprobar, cancelar y editar son cosas distintas ─────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a4');
select lives_ok(
  $$update public.reservations set status = 'scheduled' where id = '00000000-0000-0000-0000-000000000501'$$,
  'aprobar una solicitud'
);
select throws_ok(
  $$update public.reservations set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000502'$$,
  'No tienes permiso para cambiar la reserva a ese estado',
  'aprobar no permite cancelar reservas ya agendadas'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a5');
select lives_ok(
  $$update public.reservations set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000502'$$,
  'cancelar una reserva'
);
select throws_ok(
  $$update public.reservations set total_price = 0 where id = '00000000-0000-0000-0000-000000000503'$$,
  'No tienes permiso para editar reservas',
  'cancelar no permite cambiar el precio'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a6');
select throws_ok(
  $$select public.update_reservation('00000000-0000-0000-0000-000000000503', 'daycare', 'Guardería',
      now() + interval '3 days', now() + interval '3 days 8 hours', 90, '', 'cancelled')$$,
  'No tienes permiso para cambiar la reserva a ese estado',
  'editar no permite cancelar desde el formulario'
);
select lives_ok(
  $$select public.update_reservation('00000000-0000-0000-0000-000000000503', 'daycare', 'Guardería',
      now() + interval '3 days', now() + interval '3 days 8 hours', 90, '', null)$$,
  'editar sí cambia el precio'
);

-- ─── Check-out: cobrar es aparte ───────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000005ab');
select throws_ok(
  $$select public.complete_checkout('00000000-0000-0000-0000-000000000504', 'cash')$$,
  'No tienes permiso para cobrar',
  'hacer check-out no da permiso de cobrar en efectivo'
);

-- ─── Facturas: cobrar y anular ─────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a7');
select lives_ok(
  $$update public.invoices set status = 'paid', payment_method = 'cash', paid_at = now()
    where id = '00000000-0000-0000-0000-0000000005c9'$$,
  'registrar el pago de una factura'
);
select throws_ok(
  $$update public.invoices set total = 1 where id = '00000000-0000-0000-0000-0000000005c9'$$,
  'No tienes permiso para editar facturas',
  'registrar pagos no permite cambiar el total'
);
select throws_ok(
  $$update public.invoices set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000005c9'$$,
  'No tienes permiso para anular facturas',
  'registrar pagos no permite anular'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a8');
select lives_ok(
  $$update public.invoices set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000005c9'$$,
  'anular una factura'
);

-- ─── Visibilidad ───────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000005aa');
select is((select count(*)::int from public.medical_history), 0,
  'sin "ver historia clínica" no se ve el historial');
select is((select count(*)::int from public.tasks), 1,
  'sin "ver todas las tareas" solo se ven las propias');

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a9');
select is((select count(*)::int from public.medical_history), 1,
  'la especialidad veterinaria da acceso al historial');
select ok('00000000-0000-0000-0000-00000000050a' in (select public.get_org_ids_with_permission('clinical.edit')),
  'la especialidad veterinaria da permiso de registrar historia clínica');

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1');
select is((select count(*)::int from public.tasks), 2,
  'el administrador ve todas las tareas');

reset role;
select * from finish();
rollback;
