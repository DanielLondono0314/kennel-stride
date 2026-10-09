-- Tests de multi-sede (20261015000000_multi_sede).
-- Corre con `supabase test db` (pgTAP). Transacción con ROLLBACK final.
-- El runner es superusuario: se prueban RPCs, triggers y guards con
-- auth.uid() simulado, no la RLS.

begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ─── Seed ──────────────────────────────────────────────────────────────────
-- p1: principal Premium con pago activo (dueño o1, trabajador w1)
-- t1: centro en trial Premium (dueño o2)
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000e001', 'owner-premium@sede.local'),
       ('00000000-0000-0000-0000-00000000e002', 'owner-trial@sede.local'),
       ('00000000-0000-0000-0000-00000000e003', 'worker@sede.local'),
       ('00000000-0000-0000-0000-00000000e004', 'extrano@sede.local');

insert into public.organizations (id, name, slug, owner_id, plan_tier, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-0000000ee001', 'Principal', 'sede-test-principal',
        '00000000-0000-0000-0000-00000000e001', 'premium', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-0000000ee002', 'En trial', 'sede-test-trial',
        '00000000-0000-0000-0000-00000000e002', 'premium', 'trialing', now() + interval '10 days');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-0000000ee001', '00000000-0000-0000-0000-00000000e001', 'admin'),
       ('00000000-0000-0000-0000-0000000ee001', '00000000-0000-0000-0000-00000000e003', 'worker'),
       ('00000000-0000-0000-0000-0000000ee002', '00000000-0000-0000-0000-00000000e002', 'admin');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- Sin claims, auth.uid() es NULL: así entra el webhook (service_role).
create or replace function pg_temp.act_as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;

-- ─── Cupo y creación ──────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000e001');
select is((public.get_sede_quota('00000000-0000-0000-0000-0000000ee001')->>'can_create')::boolean, true,
  'Premium activo puede crear sedes');
select is((public.get_sede_quota('00000000-0000-0000-0000-0000000ee001')->>'max')::int, 5,
  'Premium incluye hasta 5 centros');

select lives_ok(
  $$select public.create_sede('00000000-0000-0000-0000-0000000ee001', 'Sede Norte', 'sede-test-norte', '2026-10-15')$$,
  'el dueño crea una sede'
);
select is((select parent_org_id from public.organizations where slug = 'sede-test-norte'),
          '00000000-0000-0000-0000-0000000ee001'::uuid,
  'la sede cuelga de la principal');
select is((select subscription_status from public.organizations where slug = 'sede-test-norte'), 'active',
  'la sede hereda la suscripción activa (no arranca un trial propio)');
select is((select count(*)::int from public.organization_members m
             join public.organizations o on o.id = m.organization_id
           where o.slug = 'sede-test-norte' and m.user_id = '00000000-0000-0000-0000-00000000e001'), 1,
  'el dueño queda como admin de la sede');

-- Pedir una sede desde otra sede la crea bajo la principal (sin anidar).
select lives_ok(
  $$select public.create_sede((select id from public.organizations where slug = 'sede-test-norte'),
                              'Sede Sur', 'sede-test-sur', '2026-10-15')$$,
  'se puede crear una sede estando en otra sede'
);
select is((select parent_org_id from public.organizations where slug = 'sede-test-sur'),
          '00000000-0000-0000-0000-0000000ee001'::uuid,
  'las sedes no se anidan: cuelgan siempre de la principal');

-- Límite del plan (se baja a 3 para no chocar con el límite de 3 centros/24 h).
select pg_temp.act_as_service();
update public.plan_catalog set max_locations = 3 where tier = 'premium';
select pg_temp.act_as('00000000-0000-0000-0000-00000000e001');
select throws_ok(
  $$select public.create_sede('00000000-0000-0000-0000-0000000ee001', 'Sede Este', 'sede-test-este', '2026-10-15')$$,
  'Tu plan permite hasta 3 sedes',
  'no se supera el cupo de sedes del plan'
);

-- ─── Quién NO puede crear sedes ───────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000e002');
select throws_ok(
  $$select public.create_sede('00000000-0000-0000-0000-0000000ee002', 'Sede Trial', 'sede-test-x', '2026-10-15')$$,
  'Las sedes están disponibles con el plan Premium activo',
  'en el trial no se crean sedes'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000e003');
select throws_ok(
  $$select public.create_sede('00000000-0000-0000-0000-0000000ee001', 'Sede W', 'sede-test-w', '2026-10-15')$$,
  'Solo el dueño de la sede principal puede crear sedes',
  'un trabajador no crea sedes'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000e004');
select throws_ok(
  $$select public.create_sede('00000000-0000-0000-0000-0000000ee001', 'Sede X', 'sede-test-y', '2026-10-15')$$,
  'Centro no encontrado',
  'alguien ajeno ni siquiera ve la principal'
);

-- ─── Un solo centro independiente por cuenta ──────────────────────────────
-- (con o2: o1 ya creó 3 centros hoy y chocaría antes con el límite diario)
select pg_temp.act_as('00000000-0000-0000-0000-00000000e002');
select throws_ok(
  $$select public.create_organization('Otro negocio', 'sede-test-otro', '2026-10-15')$$,
  'Ya tienes un centro. Las sedes adicionales se crean desde Configuración → Sedes (plan Premium)',
  'no se abre un segundo centro independiente (con trial nuevo) por onboarding'
);

-- ─── Nadie se cuelga de una principal ajena ───────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000e002');
select throws_ok(
  $$update public.organizations set parent_org_id = '00000000-0000-0000-0000-0000000ee001'
      where id = '00000000-0000-0000-0000-0000000ee002'$$,
  'La suscripción solo puede cambiarse desde facturación',
  'un admin no puede volver su centro sede de otra principal (Premium gratis)'
);

-- ─── La suscripción de las sedes sigue a la principal ─────────────────────
select pg_temp.act_as_service();
update public.organizations set plan_tier = 'pro' where id = '00000000-0000-0000-0000-0000000ee001';
select is((select subscription_status from public.organizations where slug = 'sede-test-norte'), 'suspended',
  'si la principal baja de Premium, las sedes se suspenden');
select is((select count(*)::int from public.organizations where slug = 'sede-test-norte'), 1,
  'suspender no borra la sede');

update public.organizations set plan_tier = 'premium' where id = '00000000-0000-0000-0000-0000000ee001';
select is((select subscription_status from public.organizations where slug = 'sede-test-norte'), 'active',
  'al volver a Premium las sedes se reactivan solas');

update public.organizations set subscription_status = 'past_due' where id = '00000000-0000-0000-0000-0000000ee001';
select is((select subscription_status from public.organizations where slug = 'sede-test-sur'), 'past_due',
  'un pago vencido de la principal se refleja en todas sus sedes');

-- ─── Funciones internas fuera del alcance de los clientes ─────────────────
select ok(not has_function_privilege('authenticated', 'public.sync_sedes_billing(uuid)', 'execute'),
  'authenticated no puede forzar la sincronización de sedes');
select ok(not has_function_privilege('authenticated', 'public.assert_new_org_allowed(text, text)', 'execute'),
  'authenticated no llama directo a la validación interna');

select * from finish();
rollback;
