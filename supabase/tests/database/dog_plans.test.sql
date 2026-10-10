-- Planes de los perros: check-out cubierto por un plan (descuento automático
-- de unidades, sin factura), validaciones y avisos de planes por vencer.
-- Corre con `supabase test db` (pgTAP) dentro de una transacción con ROLLBACK.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ─── Seed ───────────────────────────────────────────────────────────────────
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000001a1', 'plan-admin-a@test.local'),
       ('00000000-0000-0000-0000-0000000001b1', 'plan-admin-b@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-00000000010a', 'Plan Org A', 'plan-org-a',
        '00000000-0000-0000-0000-0000000001a1', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-00000000010b', 'Plan Org B', 'plan-org-b',
        '00000000-0000-0000-0000-0000000001b1', 'active', now() + interval '1 year');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-0000000001a1', 'admin'),
       ('00000000-0000-0000-0000-00000000010b', '00000000-0000-0000-0000-0000000001b1', 'admin');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000001c1', 'Dueña', 'Plan', 'plan@test.local', '555',
        '00000000-0000-0000-0000-00000000010a');

insert into public.dogs (id, customer_id, name, breed, organization_id)
values ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001c1', 'Toby', 'Criollo',
        '00000000-0000-0000-0000-00000000010a'),
       ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001c1', 'Luna', 'Criolla',
        '00000000-0000-0000-0000-00000000010a');

-- Toby: 3 días de guardería (se descuenta por día). Luna: internado ya vencido.
insert into public.dog_plans (id, organization_id, dog_id, service_type, service_label, category, billing,
                              start_date, end_date, quantity_total, unit_label, consumption, price)
values ('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-00000000010a',
        '00000000-0000-0000-0000-0000000001d1', 'daycare', 'Guardería 3 días', 'daycare', 'quantity',
        current_date - 5, null, 3, 'días', 'per_day', 300),
       ('00000000-0000-0000-0000-0000000001f2', '00000000-0000-0000-0000-00000000010a',
        '00000000-0000-0000-0000-0000000001d2', 'board_and_train', 'Internado', 'boarding', 'duration',
        current_date - 60, current_date - 30, null, null, null, 1000);

insert into public.reservations (id, organization_id, customer_id, dog_id, service_type, service_name,
                                 status, start_date, end_date, check_in_time, total_price)
values ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-00000000010a',
        '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001d1', 'daycare', 'Guardería',
        'checked_in', now() - interval '1 day', now(), now() - interval '1 day', 80),
       ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-00000000010a',
        '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001d1', 'daycare', 'Guardería',
        'checked_in', now() - interval '2 days', now(), now() - interval '2 days', 80),
       ('00000000-0000-0000-0000-0000000001e3', '00000000-0000-0000-0000-00000000010a',
        '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001d2', 'board_and_train', 'Internado',
        'checked_in', now(), now() + interval '1 day', now(), 500);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ─── Check-out con plan ─────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000001b1');
select throws_ok(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000001e1', 'plan', null, '', '00000000-0000-0000-0000-0000000001f1')$$,
  'Reserva inválida, fuera de tu organización, no está en curso o no tienes permiso para hacer check-out',
  'otra organización no puede cobrar con el plan'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a1');

select throws_ok(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000001e1', 'plan')$$,
  'Falta el plan con el que se cubre el servicio'
);

select throws_ok(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000001e1', 'plan', null, '', '00000000-0000-0000-0000-0000000001f2')$$,
  'El plan no es de este perro'
);

select is(
  (public.complete_checkout('00000000-0000-0000-0000-0000000001e1', 'plan', null, '', '00000000-0000-0000-0000-0000000001f1') ->> 'plan_units')::int,
  2,
  'una estadía de 2 días descuenta 2 unidades de un plan por día'
);

select is(
  (select quantity_used from public.dog_plans where id = '00000000-0000-0000-0000-0000000001f1'),
  2,
  'el contador del plan sube en la misma transacción'
);

select is(
  (select count(*)::int from public.dog_plan_usage
    where plan_id = '00000000-0000-0000-0000-0000000001f1'
      and reservation_id = '00000000-0000-0000-0000-0000000001e1' and quantity = 2),
  1,
  'queda el uso registrado con su reserva'
);

select is(
  (select count(*)::int from public.invoices where reservation_id = '00000000-0000-0000-0000-0000000001e1'),
  0,
  'un check-out cubierto por el plan no factura'
);

select is(
  (select status from public.reservations where id = '00000000-0000-0000-0000-0000000001e1'),
  'completed',
  'la reserva queda completada'
);

select throws_like(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000001e2', 'plan', null, '', '00000000-0000-0000-0000-0000000001f1')$$,
  'Al plan solo le quedan 1 días y esta estadía usa 3%',
  'no deja usar más unidades de las que quedan'
);

select throws_like(
  $$select public.complete_checkout('00000000-0000-0000-0000-0000000001e3', 'plan', null, '', '00000000-0000-0000-0000-0000000001f2')$$,
  'El plan venció el %',
  'un plan vencido no cubre la reserva'
);

-- ─── Avisos ─────────────────────────────────────────────────────────────────
select ok(
  not has_function_privilege('authenticated', 'public.check_expiring_dog_plans_all_orgs()', 'execute'),
  'el escaneo de avisos solo lo corre el servidor'
);

select cmp_ok(
  public.check_expiring_dog_plans_all_orgs(), '>=', 1,
  'avisa del plan al que le queda 1 día'
);

select is(
  public.check_expiring_dog_plans_all_orgs(), 0,
  'no repite el aviso del mismo plan'
);

-- ─── Recordatorio al dueño ──────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000001a1');
select lives_ok(
  $$select public.mark_plan_reminded('00000000-0000-0000-0000-0000000001f1', 'expiring')$$,
  'quien agenda registra el recordatorio enviado'
);
select is(
  (select reminded_state from public.dog_plans where id = '00000000-0000-0000-0000-0000000001f1'),
  'expiring',
  'queda guardado por qué situación se avisó'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000001b1');
set local role authenticated;
select throws_ok(
  $$select public.mark_plan_reminded('00000000-0000-0000-0000-0000000001f1', 'expired')$$,
  'Plan no encontrado o sin permiso',
  'otra organización no puede marcarlo'
);
reset role;

select * from finish();
rollback;
