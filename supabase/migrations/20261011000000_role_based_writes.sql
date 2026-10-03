-- Escrituras según el rol, no solo según la membresía.
--
-- Hasta ahora perros, clientes, alergias, medicación, temperamento,
-- perreras/zonas, campañas y avisos se podían crear, editar y BORRAR con solo
-- ser miembro de la organización (get_active_org_ids): la app escondía los
-- botones, pero cualquier miembro con su sesión podía escribir directo por la
-- API. Y el permiso "Borrar clientes y perros" solo ocultaba el botón.
--
-- Ahora cada tabla exige el permiso que corresponde a su uso:
--   perros                 crear/editar: schedule o clinical · borrar: delete_records
--   clientes               crear/editar: schedule o billing  · borrar: delete_records
--   alergias, medicación,
--   temperamento           schedule o clinical
--   perreras y zonas       manage_facility o schedule
--   campañas               send_campaign
--   pesos (insertar)       record_weight o clinical
--   avisos                 crear: cualquier miembro (rondas del trabajador);
--                          actualizar: solo leído/descartado; borrar: admin
-- Las funciones SECURITY DEFINER (check-in, mover perrera, avisos automáticos)
-- no cambian: hacen sus propias validaciones.

-- ── Perros ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dogs write"  ON public.dogs;
DROP POLICY IF EXISTS "dogs insert" ON public.dogs;
DROP POLICY IF EXISTS "dogs update" ON public.dogs;
DROP POLICY IF EXISTS "dogs delete" ON public.dogs;
CREATE POLICY "dogs insert" ON public.dogs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')));
CREATE POLICY "dogs update" ON public.dogs FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')));
CREATE POLICY "dogs delete" ON public.dogs FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('delete_records')));

-- ── Clientes ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "customers write"  ON public.customers;
DROP POLICY IF EXISTS "customers insert" ON public.customers;
DROP POLICY IF EXISTS "customers update" ON public.customers;
DROP POLICY IF EXISTS "customers delete" ON public.customers;
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('billing')));
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('billing')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('billing')));
CREATE POLICY "customers delete" ON public.customers FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('delete_records')));

-- ── Alergias, medicación y temperamento ─────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dog_allergies', 'dog_medications', 'dog_temperament'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING      (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
                 OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')))
        WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('schedule'))
                 OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')))
    $p$, t || ' write', t);
  END LOOP;
END $$;

-- ── Perreras y zonas ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['facility_units', 'facility_zones'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING      (organization_id IN (SELECT public.get_org_ids_with_permission('manage_facility'))
                 OR organization_id IN (SELECT public.get_org_ids_with_permission('schedule')))
        WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('manage_facility'))
                 OR organization_id IN (SELECT public.get_org_ids_with_permission('schedule')))
    $p$, t || ' write', t);
  END LOOP;
END $$;

-- ── Campañas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "campaigns write" ON public.campaigns;
CREATE POLICY "campaigns write" ON public.campaigns FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('send_campaign')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('send_campaign')));

-- ── Pesos ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dog_weight_logs insert" ON public.dog_weight_logs;
CREATE POLICY "dog_weight_logs insert" ON public.dog_weight_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('record_weight'))
           OR organization_id IN (SELECT public.get_org_ids_with_permission('clinical')));

-- ── Avisos ──────────────────────────────────────────────────────────────────
-- Cualquier miembro los crea (rondas del trabajador) y los marca leídos o
-- descartados; nadie reescribe su contenido y solo un admin los borra.
DROP POLICY IF EXISTS "notices write"  ON public.notices;
DROP POLICY IF EXISTS "notices insert" ON public.notices;
DROP POLICY IF EXISTS "notices update" ON public.notices;
DROP POLICY IF EXISTS "notices delete" ON public.notices;
CREATE POLICY "notices insert" ON public.notices FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_active_org_ids()));
CREATE POLICY "notices update" ON public.notices FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_active_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_active_org_ids()));
CREATE POLICY "notices delete" ON public.notices FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()));

REVOKE UPDATE ON public.notices FROM authenticated;
GRANT  UPDATE (is_read, is_dismissed) ON public.notices TO authenticated;
