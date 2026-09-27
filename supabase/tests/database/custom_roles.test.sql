-- Tests de roles personalizados por organización (20260928000000_custom_roles).
-- Corre con `supabase test db` (pgTAP). Todo dentro de una transacción que
-- termina en ROLLBACK: no deja rastro.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ─── Seed: org A con admin, cajero (rol panel solo 'billing') y worker; org B ─
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000aa01', 'admin-a@test.local'),
       ('00000000-0000-0000-0000-00000000aa02', 'cajero-a@test.local'),
       ('00000000-0000-0000-0000-00000000aa03', 'worker-a@test.local'),
       ('00000000-0000-0000-0000-00000000bb01', 'admin-b@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at, plan_tier)
values ('00000000-0000-0000-0000-00000000a100', 'Org A', 'test-roles-org-a',
        '00000000-0000-0000-0000-00000000aa01', 'active', now() + interval '1 year', 'premium'),
       ('00000000-0000-0000-0000-00000000b100', 'Org B', 'test-roles-org-b',
        '00000000-0000-0000-0000-00000000bb01', 'active', now() + interval '1 year', 'premium');

select is((select count(*)::int from public.org_roles
           where organization_id = '00000000-0000-0000-0000-00000000a100' and is_system), 4,
  'una org nueva recibe los 4 roles de sistema');

-- Solo `role` (código legado) → role_id del rol de sistema equivalente.
insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000a100', '00000000-0000-0000-0000-00000000aa01', 'admin'),
       ('00000000-0000-0000-0000-00000000a100', '00000000-0000-0000-0000-00000000aa03', 'worker'),
       ('00000000-0000-0000-0000-00000000b100', '00000000-0000-0000-0000-00000000bb01', 'admin');

select is((select r.system_key::text from public.organization_members m join public.org_roles r on r.id = m.role_id
           where m.user_id = '00000000-0000-0000-0000-00000000aa03'), 'worker',
  'insert con solo role recibe el role_id de sistema');

insert into public.org_roles (id, organization_id, name, access_type, permissions)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a100',
        'Cajero', 'panel', array['billing']);

-- Solo role_id → role derivado ('front_desk' para panel personalizado).
insert into public.organization_members (organization_id, user_id, role_id)
values ('00000000-0000-0000-0000-00000000a100', '00000000-0000-0000-0000-00000000aa02',
        '00000000-0000-0000-0000-00000000c001');

select is((select role::text from public.organization_members
           where user_id = '00000000-0000-0000-0000-00000000aa02'), 'front_desk',
  'rol panel personalizado se sincroniza como front_desk');

select throws_ok(
  $$insert into public.org_roles (organization_id, name, access_type, permissions)
    values ('00000000-0000-0000-0000-00000000a100', 'Malo', 'panel', array['hackear'])$$,
  'Permiso desconocido en el rol',
  'un permiso fuera del catálogo se rechaza'
);

select throws_ok(
  $$insert into public.organization_members (organization_id, user_id, role_id)
    values ('00000000-0000-0000-0000-00000000b100', '00000000-0000-0000-0000-00000000aa02',
            '00000000-0000-0000-0000-00000000c001')$$,
  'El rol no pertenece a esta organización',
  'no se puede asignar un rol de otra organización'
);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- ─── Capacidades del cajero ───────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa02');
select ok('00000000-0000-0000-0000-00000000a100' in (select public.get_finance_writer_org_ids()),
  'cajero (billing) puede escribir finanzas');
select ok('00000000-0000-0000-0000-00000000a100' not in (select public.get_scheduler_org_ids()),
  'cajero sin schedule no agenda');
select ok(not public.has_org_permission('00000000-0000-0000-0000-00000000a100', 'send_campaign'),
  'cajero sin send_campaign');
select ok('00000000-0000-0000-0000-00000000a100' not in (select public.get_admin_org_ids()),
  'cajero no es admin');
-- La RLS de UPDATE no lanza error: filtra la fila y afecta 0 filas.
update public.org_roles set permissions = public.org_permission_catalog()
where id = '00000000-0000-0000-0000-00000000c001';
select ok(not public.has_org_permission('00000000-0000-0000-0000-00000000a100', 'send_campaign'),
  'un no-admin no puede auto-asignarse permisos editando su rol');

-- ─── Aislamiento entre orgs ───────────────────────────────────────────────
select is((select count(*)::int from public.org_roles
           where organization_id = '00000000-0000-0000-0000-00000000b100'), 0,
  'no se ven los roles de otra organización');

-- ─── Admin: edita permisos y el cambio aplica de inmediato ────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update public.org_roles set permissions = array['billing','schedule']
where id = '00000000-0000-0000-0000-00000000c001';

select pg_temp.act_as('00000000-0000-0000-0000-00000000aa02');
select ok('00000000-0000-0000-0000-00000000a100' in (select public.get_scheduler_org_ids()),
  'al marcar schedule, el cajero ya puede agendar');

select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
select throws_ok(
  $$delete from public.org_roles where organization_id = '00000000-0000-0000-0000-00000000a100' and system_key = 'worker'$$,
  'Los roles predeterminados no se pueden eliminar (puedes renombrarlos)',
  'los roles de sistema no se eliminan'
);
select throws_ok(
  $$delete from public.org_roles where id = '00000000-0000-0000-0000-00000000c001'$$,
  'Este rol está asignado a personas o invitaciones. Reasígnalas antes de eliminarlo',
  'no se elimina un rol con personas asignadas'
);
select throws_ok(
  $$update public.organization_members set role = 'worker'
    where user_id = '00000000-0000-0000-0000-00000000aa01'$$,
  'La organización debe tener al menos un administrador',
  'no se puede dejar la org sin administrador'
);

-- Cambiar el tipo de un rol personalizado re-sincroniza a sus miembros.
update public.org_roles set access_type = 'worker'
where id = '00000000-0000-0000-0000-00000000c001';
select is((select role::text from public.organization_members
           where user_id = '00000000-0000-0000-0000-00000000aa02'), 'worker',
  'cambiar el tipo de acceso actualiza el enum de sus miembros');

select * from finish();
rollback;
