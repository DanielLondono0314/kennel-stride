-- ============================================================================
-- Validación runtime de las correcciones de seguridad (Fase 1 + 2).
-- Confirma comportamiento real contra Postgres (no solo que las migraciones
-- apliquen). Corre en una transacción y hace ROLLBACK (no deja datos).
--
-- Cómo correr (con Supabase local levantado):
--   docker exec -i supabase_db_<ref> psql -U postgres -d postgres -q < tests/sql/validate_runtime.sql
-- o con psql instalado:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -q -f tests/sql/validate_runtime.sql
--
-- Esperado: C1/H2/C2/C3/C4 todos "PASS". Resultado del 2026-05-29: 5/5 PASS.
-- ============================================================================
SET client_min_messages TO notice;
BEGIN;

-- ===== Fixtures (as postgres; bypasses RLS) =====
INSERT INTO auth.users (id, email, is_sso_user, is_anonymous) VALUES
 ('0b000000-0000-0000-0000-000000000001','admin@a.com',false,false),
 ('0b000000-0000-0000-0000-000000000002','trainer@a.com',false,false),
 ('0b000000-0000-0000-0000-000000000003','admincanc@b.com',false,false),
 ('0b000000-0000-0000-0000-000000000004','outsider@x.com',false,false),
 ('0b000000-0000-0000-0000-000000000005','invited@example.com',false,false);

INSERT INTO public.organizations (id, slug, name, subscription_status, trial_ends_at) VALUES
 ('0a000000-0000-0000-0000-000000000001','org-active-test','Org Active','active', now()+interval '365 days'),
 ('0a000000-0000-0000-0000-000000000002','org-cancel-test','Org Cancel','cancelled', now()-interval '1 day');

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
 ('0a000000-0000-0000-0000-000000000001','0b000000-0000-0000-0000-000000000001','admin'),
 ('0a000000-0000-0000-0000-000000000001','0b000000-0000-0000-0000-000000000002','trainer'),
 ('0a000000-0000-0000-0000-000000000002','0b000000-0000-0000-0000-000000000003','admin');

INSERT INTO public.customers (id, organization_id, first_name, last_name, email) VALUES
 ('0c000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-000000000001','Cli','Ente','cli@a.com');

INSERT INTO public.dogs (id, organization_id, customer_id, name, breed) VALUES
 ('0d000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-000000000001','0c000000-0000-0000-0000-000000000001','Firulais','Mixed');

INSERT INTO public.packages (id, organization_id, customer_id, name, total_credits, remaining_credits, price, expires_at, status, service_type) VALUES
 ('0e000000-0000-0000-0000-000000000001','0a000000-0000-0000-0000-000000000001','0c000000-0000-0000-0000-000000000001','Pack2',2,2,100,now()+interval '30 days','active','daycare');

INSERT INTO public.organization_invitations (organization_id, email, role, token, expires_at) VALUES
 ('0a000000-0000-0000-0000-000000000001','invited@example.com','admin','tok123', now()+interval '7 days');

-- ===== C1: deduct_package_credit — descuento atómico, piso en 0, log =====
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000001', true);
DO $t$
DECLARE r int;
BEGIN
  r := public.deduct_package_credit('0e000000-0000-0000-0000-000000000001');
  r := public.deduct_package_credit('0e000000-0000-0000-0000-000000000001');
  RAISE NOTICE 'C1 tras 2 descuentos: remaining=% (esperado 0)', r;
  BEGIN
    r := public.deduct_package_credit('0e000000-0000-0000-0000-000000000001');
    RAISE NOTICE 'C1 FAIL: 3er descuento NO lanzó (got %)', r;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'C1 PASS: 3er descuento bloqueado por piso (%)', SQLERRM;
  END;
END $t$;
SELECT format('C1 filas de log (esperado 2): %s', count(*)) FROM public.package_credit_log WHERE package_id='0e000000-0000-0000-0000-000000000001';
SELECT format('C1 estado paquete: status=%s remaining=%s (esperado depleted/0)', status, remaining_credits) FROM public.packages WHERE id='0e000000-0000-0000-0000-000000000001';

-- ===== H2: create_reservation — anti doble-booking =====
DO $t$
DECLARE v uuid;
BEGIN
  v := public.create_reservation('0c000000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-000000000001','daycare','Daycare', timestamptz '2026-06-01 09:00:00+00', timestamptz '2026-06-01 17:00:00+00', 50, '', NULL);
  RAISE NOTICE 'H2 1ra reserva creada: %', v;
  BEGIN
    v := public.create_reservation('0c000000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-000000000001','daycare','Daycare', timestamptz '2026-06-01 12:00:00+00', timestamptz '2026-06-01 15:00:00+00', 50, '', NULL);
    RAISE NOTICE 'H2 FAIL: reserva solapada permitida (%)', v;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'H2 PASS: solapamiento bloqueado (%)', SQLERRM;
  END;
  BEGIN
    v := public.create_reservation('0c000000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-000000000001','daycare','Daycare', timestamptz '2026-06-01 17:00:00+00', timestamptz '2026-06-01 19:00:00+00', 50, '', NULL);
    RAISE NOTICE 'H2 PASS: reserva contigua permitida (%)', v;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'H2 FAIL: contigua bloqueada por error (%)', SQLERRM;
  END;
END $t$;

-- ===== C2: accept_invitation — debe coincidir el email =====
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000004', true);
DO $t$
BEGIN
  PERFORM public.accept_invitation('tok123');
  RAISE NOTICE 'C2 FAIL: outsider (otro email) aceptó la invitación';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'C2 PASS: outsider bloqueado (%)', SQLERRM;
END $t$;
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000005', true);
DO $t$
BEGIN
  PERFORM public.accept_invitation('tok123');
  RAISE NOTICE 'C2 PASS: usuario con email correcto aceptó';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'C2 FAIL: usuario correcto bloqueado (%)', SQLERRM;
END $t$;
SELECT format('C2 invited ahora es miembro (esperado 1): %s', count(*)) FROM public.organization_members WHERE organization_id='0a000000-0000-0000-0000-000000000001' AND user_id='0b000000-0000-0000-0000-000000000005';

-- ===== C4: RLS por rol — trainer NO escribe finanzas, admin SÍ =====
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000002', true);
WITH upd AS (UPDATE public.packages SET price = 999 WHERE id='0e000000-0000-0000-0000-000000000001' RETURNING 1)
SELECT format('C4 trainer UPDATE packages filas (esperado 0): %s', count(*)) FROM upd;
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000001', true);
WITH upd AS (UPDATE public.packages SET price = 123 WHERE id='0e000000-0000-0000-0000-000000000001' RETURNING 1)
SELECT format('C4 admin UPDATE packages filas (esperado 1): %s', count(*)) FROM upd;
RESET ROLE;

-- ===== C3: gate de suscripción — org cancelada NO escribe, SÍ lee =====
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000003', true);
DO $t$
BEGIN
  INSERT INTO public.customers (organization_id, first_name, last_name, email)
  VALUES ('0a000000-0000-0000-0000-000000000002','X','Y','z@b.com');
  RAISE NOTICE 'C3 FAIL: admin de org cancelada pudo INSERT';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'C3 PASS: escritura de org cancelada bloqueada (%)', SQLERRM;
END $t$;
RESET ROLE;

ROLLBACK;
