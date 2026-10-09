-- Tests de membresías por plan (Esencial=basic / Pro / Premium).
-- Corre con `supabase test db` (pgTAP). Todo dentro de una transacción que
-- termina en ROLLBACK: no deja rastro.
--
-- Cubre: matriz de features, blindaje de plan_tier contra auto-upgrade por un
-- admin de kennel, RPC de platform admin (auditado + bypass de features),
-- límites de altas, apagado de notificaciones de ruta y las policies
-- RESTRICTIVE de tablas de módulos de pago.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ─── Seed: org A (basic) y org B (premium), un admin en cada una ───────────
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000a0001', 'admin-a@test.local'),
       ('00000000-0000-0000-0000-0000000b0001', 'admin-b@test.local'),
       ('00000000-0000-0000-0000-0000000c0001', 'platform@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at, plan_tier)
values ('00000000-0000-0000-0000-00000000a000', 'Org A', 'test-plan-org-a',
        '00000000-0000-0000-0000-0000000a0001', 'active', now() + interval '1 year', 'basic'),
       ('00000000-0000-0000-0000-00000000b000', 'Org B', 'test-plan-org-b',
        '00000000-0000-0000-0000-0000000b0001', 'active', now() + interval '1 year', 'premium');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000a0001', 'admin'),
       ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000b0001', 'admin');

insert into public.platform_admins (user_id, role)
values ('00000000-0000-0000-0000-0000000c0001', 'owner');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ─── Matriz de features ────────────────────────────────────────────────────
select is((select count(*)::int from public.plan_features where tier = 'basic'),   11, 'Esencial: 11 features');
select is((select count(*)::int from public.plan_features where tier = 'pro'),     15, 'Pro: 15 features');
select is((select count(*)::int from public.plan_features where tier = 'premium'), 19, 'Premium: 19 features (incluye multi-sede)');

select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');
select ok(public.org_has_feature('00000000-0000-0000-0000-00000000a000', 'invoices'),
  'Esencial incluye facturación');
select ok(not public.org_has_feature('00000000-0000-0000-0000-00000000a000', 'facility'),
  'Esencial NO incluye instalaciones');
select ok(not public.org_has_feature('00000000-0000-0000-0000-00000000a000', 'feature_inexistente'),
  'una feature desconocida es false (falla cerrado)');
select ok(public.org_has_feature('00000000-0000-0000-0000-00000000b000', 'clinic'),
  'Premium incluye clínica');

-- ─── plan_tier blindado contra auto-upgrade ────────────────────────────────
select throws_ok(
  $$update public.organizations set plan_tier = 'premium'
      where id = '00000000-0000-0000-0000-00000000a000'$$,
  'El plan solo puede cambiarse desde facturación',
  'un admin de kennel no puede subirse de plan con un UPDATE directo'
);

-- ─── Notificaciones de ruta: se apagan si el plan no las incluye ───────────
select pg_temp.act_as(null);
update public.organizations set route_notifications_enabled = true
  where id = '00000000-0000-0000-0000-00000000a000';
select is(
  (select route_notifications_enabled from public.organizations where id = '00000000-0000-0000-0000-00000000a000'),
  false,
  'Esencial no puede activar notificaciones de ruta'
);
update public.organizations set route_notifications_enabled = true
  where id = '00000000-0000-0000-0000-00000000b000';
select is(
  (select route_notifications_enabled from public.organizations where id = '00000000-0000-0000-0000-00000000b000'),
  true,
  'Premium sí puede activar notificaciones de ruta'
);

-- ─── Platform admin: cambia el plan (auditado) y ve todas las features ─────
select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');
select throws_ok(
  $$select public.platform_admin_set_plan_tier('00000000-0000-0000-0000-00000000a000', 'premium', 'x')$$,
  'No autorizado',
  'un admin de kennel no puede usar el RPC de platform admin'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000c0001');
select lives_ok(
  $$select public.platform_admin_set_plan_tier('00000000-0000-0000-0000-00000000a000', 'pro', 'QA del plan Pro')$$,
  'platform admin owner cambia el plan'
);
select is(
  (select plan_tier from public.organizations where id = '00000000-0000-0000-0000-00000000a000'),
  'pro',
  'el plan quedó en pro'
);
select is(
  (select count(*)::int from public.platform_admin_audit_log where action = 'set_plan_tier'
     and target_org_id = '00000000-0000-0000-0000-00000000a000'),
  1,
  'el cambio de plan queda en el audit log'
);
select ok(public.org_has_feature('00000000-0000-0000-0000-00000000a000', 'facility'),
  'platform admin ve TODAS las features aunque la org sea Pro');

-- volver a basic para las pruebas de límites/RLS
select public.platform_admin_set_plan_tier('00000000-0000-0000-0000-00000000a000', 'basic', 'restaurar');

-- ─── Límite de perros (solo bloquea altas nuevas) ──────────────────────────
update public.plan_catalog set max_dogs = 1 where tier = 'basic';
select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000ce001', 'Cli', 'Uno', 'c@test.local', '555', '00000000-0000-0000-0000-00000000a000');

insert into public.dogs (customer_id, name, breed, organization_id)
values ('00000000-0000-0000-0000-0000000ce001', 'Uno', 'Criollo', '00000000-0000-0000-0000-00000000a000');

select throws_like(
  $$insert into public.dogs (customer_id, name, breed, organization_id)
      values ('00000000-0000-0000-0000-0000000ce001', 'Dos', 'Criollo', '00000000-0000-0000-0000-00000000a000')$$,
  'plan_limit_dogs%',
  'el plan Esencial bloquea altas de perros por encima del límite'
);

-- ─── Policies RESTRICTIVE: módulos de pago ─────────────────────────────────
set local role authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-0000000b0001');
select lives_ok(
  $$insert into public.facility_zones (name, organization_id)
      values ('Zona B', '00000000-0000-0000-0000-00000000b000')$$,
  'org Premium puede crear zonas de instalaciones'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000a0001');
select throws_ok(
  $$insert into public.facility_zones (name, organization_id)
      values ('Zona A', '00000000-0000-0000-0000-00000000a000')$$,
  '42501',
  null,
  'org Esencial NO puede crear zonas de instalaciones (RLS restrictiva)'
);

reset role;
select * from finish();
rollback;
