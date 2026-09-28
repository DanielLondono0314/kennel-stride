-- Tests del endurecimiento de la auditoría 2026-09-26
-- (20260926000000_audit_security_hardening + 20260926010000_audit_kennel_integrity).
-- Corre con `supabase test db` (pgTAP). Transacción con ROLLBACK final.
--
-- Nota: el runner corre como superusuario, así que la RLS no aplica aquí; se
-- prueban triggers, guardias dentro de RPCs (vía auth.uid() simulado) y
-- privilegios EXECUTE.

begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ─── Seed: org A (admin + worker) y org B (admin) ─────────────────────────
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a001', 'admin-a@audit.local'),
       ('00000000-0000-0000-0000-00000000a002', 'worker-a@audit.local'),
       ('00000000-0000-0000-0000-00000000b001', 'admin-b@audit.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at)
values ('00000000-0000-0000-0000-0000000aa000', 'Org A', 'audit-org-a',
        '00000000-0000-0000-0000-00000000a001', 'active', now() + interval '1 year'),
       ('00000000-0000-0000-0000-0000000bb000', 'Org B', 'audit-org-b',
        '00000000-0000-0000-0000-00000000b001', 'active', now() + interval '1 year');

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-0000000aa000', '00000000-0000-0000-0000-00000000a001', 'admin'),
       ('00000000-0000-0000-0000-0000000aa000', '00000000-0000-0000-0000-00000000a002', 'worker'),
       ('00000000-0000-0000-0000-0000000bb000', '00000000-0000-0000-0000-00000000b001', 'admin');

insert into public.staff_members (id, organization_id, profile_id, first_name, last_name, email, role)
values ('00000000-0000-0000-0000-0000000aa0f1', '00000000-0000-0000-0000-0000000aa000',
        '00000000-0000-0000-0000-00000000a002', 'Wendy', 'Worker', 'worker-a@audit.local', 'worker');

insert into public.customers (id, organization_id, first_name, last_name, email, phone)
values ('00000000-0000-0000-0000-0000000aac01', '00000000-0000-0000-0000-0000000aa000', 'Ana', 'A', 'ana@x.local', '1'),
       ('00000000-0000-0000-0000-0000000bbc01', '00000000-0000-0000-0000-0000000bb000', 'Beto', 'B', 'beto@x.local', '2');

insert into public.dogs (id, organization_id, customer_id, name, breed)
values ('00000000-0000-0000-0000-0000000aad01', '00000000-0000-0000-0000-0000000aa000',
        '00000000-0000-0000-0000-0000000aac01', 'Firulais', 'Mestizo'),
       ('00000000-0000-0000-0000-0000000bbd01', '00000000-0000-0000-0000-0000000bb000',
        '00000000-0000-0000-0000-0000000bbc01', 'Rex', 'Pastor');

insert into public.facility_zones (id, organization_id, name)
values ('00000000-0000-0000-0000-0000000aa2e1', '00000000-0000-0000-0000-0000000aa000', 'Zona');
insert into public.facility_units (id, organization_id, zone_id, name, status)
values ('00000000-0000-0000-0000-0000000aa0e1', '00000000-0000-0000-0000-0000000aa000',
        '00000000-0000-0000-0000-0000000aa2e1', 'K-01', 'available');

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ─── 1. Suscripción blindada ───────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
select throws_ok(
  $$update public.organizations set subscription_status = 'active', trial_ends_at = now() + interval '50 years'
      where id = '00000000-0000-0000-0000-0000000aa000'$$,
  'La suscripción solo puede cambiarse desde facturación',
  'un admin de kennel no puede extender su suscripción'
);
select lives_ok(
  $$update public.organizations set name = 'Org A renombrada'
      where id = '00000000-0000-0000-0000-0000000aa000'$$,
  'un admin sí puede editar los datos normales de su org'
);
select throws_ok(
  $$select public.create_organization('Squat', 'platform-admin', '2026-09-29')$$,
  'Ese URL está reservado, elige otro',
  'platform-admin es un slug reservado'
);

-- ─── 2. Privilegios EXECUTE ────────────────────────────────────────────────
select ok(not has_function_privilege('anon', 'public.generate_welfare_checks_all_orgs()', 'execute'),
  'anon no puede disparar el cron de bienestar');
select ok(not has_function_privilege('authenticated', 'public.check_overdue_invoices_all_orgs()', 'execute'),
  'authenticated no puede disparar el cron de facturas');
select ok(not has_function_privilege('anon', 'public.get_inactive_customer_ids(uuid, integer)', 'execute'),
  'anon no puede listar clientes inactivos');
select ok(has_function_privilege('anon', 'public.get_invitation_by_token(text)', 'execute'),
  'anon sí puede consultar una invitación por token (pantalla /join)');

-- ─── 3. Lectura cross-org ──────────────────────────────────────────────────
select throws_ok(
  $$select public.get_onboarding_status('00000000-0000-0000-0000-0000000bb000')$$,
  'Organización inválida o fuera de tu cuenta',
  'get_onboarding_status no expone otras orgs'
);

-- ─── 4. RPCs con rol ───────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000a002');
select throws_like(
  $$select public.create_reservation('00000000-0000-0000-0000-0000000aac01', '00000000-0000-0000-0000-0000000aad01',
      'daycare', 'Guardería', now(), now() + interval '8 hours', 10)$$,
  '%sin permiso para crear reservas%',
  'un worker no puede crear reservas vía RPC'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
select throws_like(
  $$select public.create_reservation('00000000-0000-0000-0000-0000000aac01', '00000000-0000-0000-0000-0000000bbd01',
      'daycare', 'Guardería', now(), now() + interval '8 hours', 10)$$,
  '%Perro inválido%',
  'no se puede reservar con un perro de otra org'
);

-- ─── 5 y 1-integridad. Worker limitado + perrera liberada ──────────────────
select pg_temp.act_as(null);
insert into public.reservations (id, organization_id, customer_id, dog_id, staff_id, service_type, service_name,
                                 start_date, end_date, total_price, status)
values ('00000000-0000-0000-0000-0000000aa4e1', '00000000-0000-0000-0000-0000000aa000',
        '00000000-0000-0000-0000-0000000aac01', '00000000-0000-0000-0000-0000000aad01',
        '00000000-0000-0000-0000-0000000aa0f1', 'daycare', 'Guardería',
        now(), now() + interval '8 hours', 100, 'scheduled');

select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
select lives_ok(
  $$select public.check_in_reservation('00000000-0000-0000-0000-0000000aa4e1', '00000000-0000-0000-0000-0000000aa0e1', '')$$,
  'un admin hace check-in'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a002');
select throws_ok(
  $$update public.reservations set total_price = 0 where id = '00000000-0000-0000-0000-0000000aa4e1'$$,
  'Solo puedes actualizar el estado de tus reservas',
  'el worker asignado no puede cambiar el precio'
);
select lives_ok(
  $$update public.reservations set status = 'completed' where id = '00000000-0000-0000-0000-0000000aa4e1'$$,
  'el worker asignado sí puede cerrar su reserva'
);
select is(
  (select status from public.facility_units where id = '00000000-0000-0000-0000-0000000aa0e1'),
  'available',
  'cerrar la reserva libera la perrera'
);

-- ─── 6. Referencias de la misma org ────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
select throws_like(
  $$insert into public.report_cards (organization_id, dog_id, dog_name, session_date)
      values ('00000000-0000-0000-0000-0000000aa000', '00000000-0000-0000-0000-0000000bbd01', 'Rex', current_date)$$,
  '%dog_id no pertenece a esta organización%',
  'un reporte no puede apuntar al perro de otra org'
);

-- ─── 8. Campañas ───────────────────────────────────────────────────────────
select pg_temp.act_as(null);
insert into public.campaigns (id, organization_id, name, status, stats_sent)
values ('00000000-0000-0000-0000-0000000aa5c1', '00000000-0000-0000-0000-0000000aa000', 'Promo', 'sent', 50);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
select throws_ok(
  $$update public.campaigns set status = 'draft' where id = '00000000-0000-0000-0000-0000000aa5c1'$$,
  'Una campaña enviada (o en envío) no se puede modificar',
  'una campaña enviada no se puede devolver a borrador para reenviarla'
);
insert into public.campaigns (id, organization_id, name, status)
values ('00000000-0000-0000-0000-0000000aa5c2', '00000000-0000-0000-0000-0000000aa000', 'Borrador', 'draft');
select throws_ok(
  $$update public.campaigns set status = 'sent' where id = '00000000-0000-0000-0000-0000000aa5c2'$$,
  'El envío de campañas solo lo hace el servidor',
  'el cliente no puede marcar una campaña como enviada'
);

-- ─── 9. Créditos auditados ─────────────────────────────────────────────────
select pg_temp.act_as(null);
insert into public.packages (id, organization_id, customer_id, name, service_type, total_credits,
                             remaining_credits, status, expires_at, price)
values ('00000000-0000-0000-0000-0000000aa9a1', '00000000-0000-0000-0000-0000000aa000',
        '00000000-0000-0000-0000-0000000aac01', 'Bono', 'daycare', 10, 10, 'active', current_date + 30, 100);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a001');
update public.packages set remaining_credits = 9 where id = '00000000-0000-0000-0000-0000000aa9a1';
select is(
  (select count(*)::int from public.package_credit_log
    where package_id = '00000000-0000-0000-0000-0000000aa9a1' and action = 'manual_update'),
  1,
  'una edición directa de créditos queda en el log'
);
select lives_ok(
  $$select public.deduct_package_credit('00000000-0000-0000-0000-0000000aa9a1', 'test')$$,
  'deduct_package_credit funciona para un admin'
);
select is(
  (select count(*)::int from public.package_credit_log where package_id = '00000000-0000-0000-0000-0000000aa9a1'),
  2,
  'el RPC registra un único movimiento (sin duplicar vía trigger)'
);

select * from finish();
rollback;
