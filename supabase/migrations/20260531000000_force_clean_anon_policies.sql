-- ============================================================================
-- HOTFIX (robusto): elimina CUALQUIER política de acceso anónimo/público en las
-- tablas sensibles y garantiza la política org-scoped correcta en reservations.
--
-- Contexto: una migración auto-generada por Lovable (20260402204454_*) re-introdujo
-- "Anon full access reservations" FOR ALL TO public USING(true) WITH CHECK(true).
-- En la cadena LIMPIA de migraciones esa política (y las equivalentes en dogs,
-- medical_history, vaccination_schedule, deworming_records, medical_conditions,
-- dog_temperament, business_profile, staff_members) ya se DROPean por nombre.
-- PERO este proyecto sufre drift de esquema con Lovable: producción puede conservar
-- estas políticas bajo OTRO nombre, así que un DROP por nombre fijo no las captura.
--
-- Esta migración, siguiendo el patrón establecido en
-- 20260530040000_force_clean_membership_policies.sql, consulta el catálogo
-- (pg_policies) y elimina dinámicamente TODA política sobre cada tabla sensible
-- cuyos roles incluyan 'anon' o 'public' (independientemente del nombre). Luego
-- recrea de forma idempotente la política org-scoped canónica de reservations.
--
-- DECISIÓN sobre booking público: se auditó el frontend (src/). NO existe ningún
-- flujo de reserva público/anónimo: todas las rutas que tocan reservations están
-- bajo <ProtectedRoute>/<OrgGuard>, y la creación pasa por el RPC SECURITY DEFINER
-- create_reservation() que está GRANTed solo a 'authenticated' y valida pertenencia
-- de org. El estado 'requested' es un estado de workflow interno (el staff crea la
-- solicitud y la aprueba/rechaza en RequestsPage), NO un booking de visitante anónimo.
-- Por tanto es seguro eliminar por completo el acceso anónimo. No se añade ningún
-- acceso anon de reemplazo.
--
-- Sin cambios de esquema/columnas → no requiere regenerar types.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Barrido defensivo: eliminar TODA política anon/public en tablas sensibles.
--    pg_policies.roles es un text[] de nombres de rol; capturamos tanto el rol
--    'anon' como el pseudo-rol 'public' (que en pg_policies aparece literalmente
--    como 'public' cuando la política se creó FOR ... TO public).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl  text;
  pol  record;
  sensitive_tables text[] := ARRAY[
    'reservations',
    'dogs',
    'medical_history',
    'vaccination_schedule',
    'deworming_records',
    'medical_conditions',
    'dog_temperament',
    'business_profile',
    'staff_members',
    'customers',
    'invoices',
    'invoice_items',
    'packages',
    'facility_zones',
    'facility_units',
    'report_cards',
    'campaigns',
    'notices'
  ];
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    -- Saltar tablas que no existan en este entorno (defensivo ante drift).
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename  = tbl
        AND (roles && ARRAY['anon']::name[] OR roles && ARRAY['public']::name[])
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      RAISE NOTICE 'Dropped anon/public policy "%" on public.%', pol.policyname, tbl;
    END LOOP;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Garantizar la política org-scoped canónica de reservations.
--    Expresión idéntica a 20260402000001_multi_tenant.sql (helper get_user_org_ids).
--    DROP IF EXISTS primero para que el CREATE sea idempotente.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members full access reservations" ON public.reservations;

CREATE POLICY "Org members full access reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

-- RLS debe seguir habilitado (defensivo; no-op si ya lo está).
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
