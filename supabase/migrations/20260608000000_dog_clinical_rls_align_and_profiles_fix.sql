-- ============================================================
-- Endurecimiento de seguridad:
-- 1) Alinear dog_allergies/dog_medications con el patrón de las tablas
--    OPERATIVAS (igual que `dogs`): lectura para miembros de la org, escritura
--    gated por suscripción activa (`get_active_org_ids`). La migración del
--    formulario las creó con un único FOR ALL sobre `get_user_org_ids`, que
--    omitía el gating de suscripción que tienen todas las demás tablas.
--    NO se vet-gatean a propósito: son datos de intake que llena front_desk.
-- 2) Eliminar la policy legacy "Admins can view all profiles" (usa el
--    `has_role` single-tenant, sin scope de org) que permitía a un admin global
--    leer el PII de profiles de TODOS los tenants. El uso real (perfil propio)
--    queda cubierto por "Users can view own profile".
-- ============================================================

-- 1. dog_allergies / dog_medications: read = miembros, write = suscripción activa.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dog_allergies','dog_medications'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org_access', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' read',  t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (organization_id IN (SELECT public.get_user_org_ids()))',
      t || ' read', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (organization_id IN (SELECT public.get_active_org_ids())) '
      'WITH CHECK (organization_id IN (SELECT public.get_active_org_ids()))',
      t || ' write', t);
  END LOOP;
END $$;

-- 2. Eliminar la policy legacy cross-tenant de profiles.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
