-- ============================================================================
-- STREAM D — RLS por rol + enforcement de suscripción (C3, C4)  · Fase 2
--
-- Problema (causa-raíz): todas las tablas de negocio tenían UNA política
-- `FOR ALL TO authenticated USING (organization_id IN get_user_org_ids())`,
-- de modo que:
--   • Cualquier miembro (incluido 'trainer') podía escribir finanzas
--     (precios, facturas, créditos) vía API directa — los roles solo vivían
--     en la UI (usePermission). [C4]
--   • La suscripción no se validaba en BD: una org con trial vencido o
--     cancelada seguía pudiendo escribir vía API. [C3]
--
-- Estrategia (patrón uniforme de 2 políticas por tabla):
--   1) SELECT  → cualquier miembro de la org (get_user_org_ids). Se deja la
--      LECTURA abierta aunque la suscripción haya vencido, para que el cliente
--      pueda ver/exportar sus datos y reactivar.
--   2) FOR ALL (write) → gated por suscripción vigente (get_active_org_ids) y,
--      en tablas financieras, además por rol (get_finance_writer_org_ids);
--      staff_members solo admin (get_admin_org_ids).
--
-- Nota: los RPCs de Fase 1 (deduct_package_credit, create_reservation,
-- accept_invitation, etc.) son SECURITY DEFINER → corren como owner y
-- BYPASEAN RLS, así que siguen funcionando tras este endurecimiento.
--
-- app_role = ('admin','front_desk','trainer','manager'). Escritores de
-- finanzas = admin/manager/front_desk (alineado con usePermission).
--
-- Idempotente: CREATE OR REPLACE + DROP POLICY IF EXISTS.
-- ============================================================================

-- ── 1. Helpers de membresía con gating ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;

CREATE OR REPLACE FUNCTION public.get_finance_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND om.role IN ('admin', 'manager', 'front_desk')
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;

CREATE OR REPLACE FUNCTION public.get_admin_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND om.role = 'admin'
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;

GRANT EXECUTE ON FUNCTION public.get_active_org_ids()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_writer_org_ids()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_org_ids()           TO authenticated;

-- ── 2. Tablas OPERATIVAS: lectura para miembros, escritura gated por suscripción
-- (cualquier rol de la org puede operar mientras la suscripción esté vigente).
DO $$
DECLARE
  t text;
  op_tables text[] := ARRAY[
    'customers','dogs','reservations','facility_zones','facility_units',
    'report_cards','campaigns','notices','medical_history','vaccination_schedule',
    'deworming_records','medical_conditions','dog_temperament'
  ];
BEGIN
  FOREACH t IN ARRAY op_tables LOOP
    -- Quitar la política FOR ALL previa y cualquier versión de las nuevas.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Org members full access ' || t, t);
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

-- Limpieza de política legacy redundante en report_cards (has_role single-tenant).
DROP POLICY IF EXISTS "Admins can manage report_cards" ON public.report_cards;

-- ── 3. Tablas FINANCIERAS: escritura solo rol financiero + suscripción vigente
-- (admin/manager/front_desk). 'trainer' queda en solo-lectura sobre finanzas. [C4]
DO $$
DECLARE
  t text;
  fin_tables text[] := ARRAY['packages','invoices','invoice_items'];
BEGIN
  FOREACH t IN ARRAY fin_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Org members full access ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' read',  t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (organization_id IN (SELECT public.get_user_org_ids()))',
      t || ' read', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (organization_id IN (SELECT public.get_finance_writer_org_ids())) '
      'WITH CHECK (organization_id IN (SELECT public.get_finance_writer_org_ids()))',
      t || ' write', t);
  END LOOP;
END $$;

-- ── 4. staff_members: gestión solo por admin (alineado con manage_staff). ─────
-- La aceptación de invitaciones (accept_invitation, SECURITY DEFINER) bypasea RLS.
DROP POLICY IF EXISTS "Org members full access staff_members" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members read"  ON public.staff_members;
DROP POLICY IF EXISTS "staff_members write" ON public.staff_members;

CREATE POLICY "staff_members read"
  ON public.staff_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "staff_members write"
  ON public.staff_members FOR ALL TO authenticated
  USING    (organization_id IN (SELECT public.get_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_admin_org_ids()));
