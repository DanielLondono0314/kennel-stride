-- Aviso de facturas vencidas: marca vencidas por fecha local del centro,
-- avisa una sola vez por factura, ignora pagadas y queda programado.

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000003a1', 'inv-admin@test.local');

insert into public.organizations (id, name, slug, owner_id, subscription_status, trial_ends_at, timezone)
values ('00000000-0000-0000-0000-00000000030a', 'Inv Org', 'inv-org',
        '00000000-0000-0000-0000-0000000003a1', 'active', now() + interval '1 year', 'America/Bogota');

insert into public.customers (id, first_name, last_name, email, phone, organization_id)
values ('00000000-0000-0000-0000-0000000003c1', 'Ana', 'Gómez', 'ana@test.local', '555',
        '00000000-0000-0000-0000-00000000030a');

insert into public.invoices (id, customer_id, status, subtotal, discount, tax, total, due_date, organization_id, invoice_number)
values
  -- pendiente con fecha pasada → se vence y avisa
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003c1', 'pending', 150000, 0, 0, 150000,
   public.org_today('00000000-0000-0000-0000-00000000030a') - 20, '00000000-0000-0000-0000-00000000030a', 'FAC-T1'),
  -- vence hoy: todavía no está vencida
  ('00000000-0000-0000-0000-0000000003f2', '00000000-0000-0000-0000-0000000003c1', 'pending', 50000, 0, 0, 50000,
   public.org_today('00000000-0000-0000-0000-00000000030a'), '00000000-0000-0000-0000-00000000030a', 'FAC-T2'),
  -- pagada con fecha pasada: nunca avisa
  ('00000000-0000-0000-0000-0000000003f3', '00000000-0000-0000-0000-0000000003c1', 'paid', 80000, 0, 0, 80000,
   public.org_today('00000000-0000-0000-0000-00000000030a') - 40, '00000000-0000-0000-0000-00000000030a', 'FAC-T3');

select cmp_ok(public.check_overdue_invoices_all_orgs(), '>=', 1, 'crea avisos de facturas vencidas');

select is(
  (select status from public.invoices where id = '00000000-0000-0000-0000-0000000003f1'), 'overdue',
  'la pendiente con fecha pasada queda vencida'
);
select is(
  (select status from public.invoices where id = '00000000-0000-0000-0000-0000000003f2'), 'pending',
  'la que vence hoy sigue pendiente'
);
select is(
  (select message from public.notices where entity_type = 'invoice' and entity_id = '00000000-0000-0000-0000-0000000003f1'),
  'Factura FAC-T1 de Ana Gómez por $ 150.000 venció el ' || to_char(public.org_today('00000000-0000-0000-0000-00000000030a') - 20, 'DD/MM/YYYY') || ' (hace 20 días).',
  'mensaje con cliente, monto en pesos y días de atraso'
);
select is(
  (select severity from public.notices where entity_type = 'invoice' and entity_id = '00000000-0000-0000-0000-0000000003f1'),
  'critical',
  'más de 15 días vencida es crítica'
);
select is(
  (select count(*)::int from public.notices where entity_type = 'invoice' and entity_id = '00000000-0000-0000-0000-0000000003f3'),
  0,
  'una factura pagada no avisa'
);

select is(public.check_overdue_invoices_all_orgs(), 0, 'al día siguiente no repite el aviso');
select is(
  (select count(*)::int from public.notices where entity_type = 'invoice' and entity_id = '00000000-0000-0000-0000-0000000003f1'),
  1,
  'un solo aviso por factura'
);

-- En CI no hay pg_cron: cron.job solo se consulta si existe (SQL dinámico).
create or replace function pg_temp.job_ok() returns boolean language plpgsql as $$
declare v boolean;
begin
  if to_regclass('cron.job') is null then return true; end if;
  execute $q$select exists (select 1 from cron.job where jobname = 'check_overdue_invoices_daily' and schedule = '5 12 * * *')$q$ into v;
  return v;
end $$;
select ok(pg_temp.job_ok(), 'queda programado todos los días a las 7:05 a. m. de Bogotá');

select * from finish();
rollback;
