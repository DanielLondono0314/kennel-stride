-- ============================================================================
-- Roles y permisos personalizados por organización.
--
-- Cada org define sus roles (nombre libre + tipo de acceso + permisos por
-- capacidad). Los 4 roles de siempre se siembran como roles "de sistema".
--
-- Compatibilidad: la columna enum `role` (app_role) de organization_members,
-- organization_invitations y staff_members se CONSERVA y se sincroniza por
-- trigger con `role_id`:
--   access_type admin  → 'admin'
--   access_type worker → 'worker'
--   access_type panel  → system_key del rol, o 'front_desk' (el valor de panel
--                        menos privilegiado) para roles personalizados.
-- Así todo chequeo legado `role = 'admin'` / `role = 'worker'` (policies de
-- membresías/invitaciones, is_org_admin, welfare checks, WorkerRoute) sigue
-- siendo correcto, y los INSERT que solo pasan `role` (create_organization,
-- tests) reciben el role_id de sistema equivalente.
--
-- Los permisos de negocio se aplican redefiniendo las funciones de capacidad
-- que ya usa toda la RLS (get_scheduler_org_ids, get_finance_writer_org_ids,
-- get_clinical_writer_org_ids, get_reportcard_writer_org_ids,
-- get_admin_org_ids) — sin reescribir cada policy.
--
-- Gestionar personal, roles y configuración NO es una casilla: es exclusivo
-- del tipo de acceso 'admin' (evita que un rol se auto-escale privilegios).
-- ============================================================================

-- ── 1. Catálogo y tabla ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_permission_catalog()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'schedule','billing','cancel_invoice','clinical','report_cards',
    'delete_records','view_reports','send_campaign','manage_facility','record_weight'
  ]::text[];
$$;

CREATE TABLE IF NOT EXISTS public.org_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 40),
  access_type     text NOT NULL CHECK (access_type IN ('admin','panel','worker')),
  permissions     text[] NOT NULL DEFAULT '{}',
  is_system       boolean NOT NULL DEFAULT false,
  system_key      public.app_role,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_roles_permissions_valid CHECK (permissions <@ public.org_permission_catalog()),
  CONSTRAINT org_roles_system_key CHECK ((system_key IS NOT NULL) = is_system)
);

CREATE UNIQUE INDEX IF NOT EXISTS org_roles_org_name_key
  ON public.org_roles (organization_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS org_roles_org_system_key
  ON public.org_roles (organization_id, system_key) WHERE system_key IS NOT NULL;

ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;
-- Explícito: los proyectos nuevos de Supabase ya no otorgan acceso por defecto
-- a tablas nuevas del esquema public. La RLS de abajo es la que restringe.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_roles TO authenticated;
GRANT ALL ON public.org_roles TO service_role;

-- Los roles de sistema solo los crea seed_org_system_roles (SECURITY DEFINER,
-- bypassa RLS): un admin solo puede insertar roles personalizados.
DROP POLICY IF EXISTS "org_roles read"   ON public.org_roles;
DROP POLICY IF EXISTS "org_roles insert" ON public.org_roles;
DROP POLICY IF EXISTS "org_roles update" ON public.org_roles;
DROP POLICY IF EXISTS "org_roles delete" ON public.org_roles;
CREATE POLICY "org_roles read" ON public.org_roles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
CREATE POLICY "org_roles insert" ON public.org_roles FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_admin_org_ids()) AND NOT is_system);
CREATE POLICY "org_roles update" ON public.org_roles FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_admin_org_ids()));
CREATE POLICY "org_roles delete" ON public.org_roles FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()));

-- ── 2. Roles de sistema (misma matriz que usePermission.ts antes de esto) ──
CREATE OR REPLACE FUNCTION public.seed_org_system_roles(p_org uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.org_roles (organization_id, name, access_type, permissions, is_system, system_key)
  VALUES
    (p_org, 'Administrador', 'admin', public.org_permission_catalog(), true, 'admin'),
    (p_org, 'Gerente', 'panel', ARRAY[
      'schedule','billing','cancel_invoice','clinical','report_cards',
      'delete_records','view_reports','send_campaign','manage_facility','record_weight'], true, 'manager'),
    (p_org, 'Recepción', 'panel', ARRAY['schedule','billing','record_weight'], true, 'front_desk'),
    (p_org, 'Trabajador', 'worker', ARRAY['record_weight'], true, 'worker')
  ON CONFLICT (organization_id, system_key) WHERE system_key IS NOT NULL DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_org_system_roles(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_org_system_roles_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_org_system_roles(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_seed_roles ON public.organizations;
CREATE TRIGGER organizations_seed_roles
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_org_system_roles_trg();

SELECT public.seed_org_system_roles(id) FROM public.organizations;

-- ── 3. role_id en membresías, invitaciones y personal ──────────────────────
ALTER TABLE public.organization_members     ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.org_roles(id);
ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.org_roles(id);
ALTER TABLE public.staff_members            ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.org_roles(id);

CREATE INDEX IF NOT EXISTS organization_members_role_id_idx     ON public.organization_members (role_id);
CREATE INDEX IF NOT EXISTS organization_invitations_role_id_idx ON public.organization_invitations (role_id);
CREATE INDEX IF NOT EXISTS staff_members_role_id_idx            ON public.staff_members (role_id);

UPDATE public.organization_members t SET role_id = r.id
FROM public.org_roles r
WHERE t.role_id IS NULL AND r.organization_id = t.organization_id AND r.system_key = t.role;

UPDATE public.organization_invitations t SET role_id = r.id
FROM public.org_roles r
WHERE t.role_id IS NULL AND r.organization_id = t.organization_id AND r.system_key = t.role;

UPDATE public.staff_members t SET role_id = r.id
FROM public.org_roles r
WHERE t.role_id IS NULL AND r.organization_id = t.organization_id AND r.system_key = t.role;

ALTER TABLE public.organization_members     ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE public.organization_invitations ALTER COLUMN role_id SET NOT NULL;
-- staff_members.role_id queda nullable: hay filas legacy sin organization_id.

-- ── 4. Sincronización role ↔ role_id ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_role_enum(p_access_type text, p_system_key public.app_role)
RETURNS public.app_role LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_access_type = 'admin'  THEN 'admin'::public.app_role
    WHEN p_access_type = 'worker' THEN 'worker'::public.app_role
    ELSE COALESCE(p_system_key, 'front_desk'::public.app_role)
  END;
$$;

-- Genérico para las 3 tablas (todas tienen organization_id, role, role_id).
-- Regla: si role_id cambió (o es INSERT con role_id), role se deriva de role_id.
-- Si solo cambió `role` y ya no coincide con role_id, role_id pasa al rol de
-- sistema de ese enum (compatibilidad con código que solo escribe `role`).
CREATE OR REPLACE FUNCTION public.sync_role_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.org_roles;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role_id IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.role_id IS DISTINCT FROM OLD.role_id
       OR NEW.role IS NOT DISTINCT FROM OLD.role
     ) THEN
    SELECT * INTO v_role FROM public.org_roles
    WHERE id = NEW.role_id AND organization_id = NEW.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El rol no pertenece a esta organización';
    END IF;
    NEW.role := public.org_role_enum(v_role.access_type, v_role.system_key);
    RETURN NEW;
  END IF;

  -- role_id NULL, o solo cambió `role`.
  IF NEW.role_id IS NOT NULL THEN
    SELECT * INTO v_role FROM public.org_roles WHERE id = NEW.role_id;
    IF FOUND AND public.org_role_enum(v_role.access_type, v_role.system_key) = NEW.role THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO NEW.role_id FROM public.org_roles
  WHERE organization_id = NEW.organization_id AND system_key = NEW.role;
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'No existe el rol de sistema % en esta organización', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_sync_role ON public.organization_members;
CREATE TRIGGER organization_members_sync_role
  BEFORE INSERT OR UPDATE OF role, role_id, organization_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_columns();

DROP TRIGGER IF EXISTS organization_invitations_sync_role ON public.organization_invitations;
CREATE TRIGGER organization_invitations_sync_role
  BEFORE INSERT OR UPDATE OF role, role_id, organization_id ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_columns();

DROP TRIGGER IF EXISTS staff_members_sync_role ON public.staff_members;
CREATE TRIGGER staff_members_sync_role
  BEFORE INSERT OR UPDATE OF role, role_id, organization_id ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_columns();

-- Nunca dejar una org sin administrador (cambio de rol de un miembro).
CREATE OR REPLACE FUNCTION public.guard_last_org_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role <> 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = OLD.organization_id AND role = 'admin' AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'La organización debe tener al menos un administrador';
  END IF;
  RETURN NEW;
END;
$$;

-- Los BEFORE triggers corren en orden alfabético: el prefijo 'z_' garantiza que
-- el guard vea `role` ya sincronizado por organization_members_sync_role.
DROP TRIGGER IF EXISTS z_organization_members_last_admin ON public.organization_members;
CREATE TRIGGER z_organization_members_last_admin
  BEFORE UPDATE OF role, role_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_org_admin();

-- Membresía ↔ ficha de Personal: el rol de una persona con cuenta es uno solo.
-- (Antes, cambiar el rol en Personal no cambiaba el acceso real.)
CREATE OR REPLACE FUNCTION public.propagate_member_role_to_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff_members
  SET role_id = NEW.role_id, updated_at = now()
  WHERE profile_id = NEW.user_id
    AND organization_id = NEW.organization_id
    AND role_id IS DISTINCT FROM NEW.role_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_propagate_role ON public.organization_members;
CREATE TRIGGER organization_members_propagate_role
  AFTER INSERT OR UPDATE OF role_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.propagate_member_role_to_staff();

CREATE OR REPLACE FUNCTION public.propagate_staff_role_to_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL AND NEW.organization_id IS NOT NULL AND NEW.role_id IS NOT NULL THEN
    UPDATE public.organization_members
    SET role_id = NEW.role_id
    WHERE user_id = NEW.profile_id
      AND organization_id = NEW.organization_id
      AND role_id IS DISTINCT FROM NEW.role_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS staff_members_propagate_role ON public.staff_members;
CREATE TRIGGER staff_members_propagate_role
  AFTER UPDATE OF role_id ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.propagate_staff_role_to_member();

-- ── 5. Reglas de edición de roles ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_org_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Borrado en cascada de la organización: no aplicar reglas.
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id) THEN
      RETURN OLD;
    END IF;
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Los roles predeterminados no se pueden eliminar (puedes renombrarlos)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.organization_members WHERE role_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.staff_members WHERE role_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.organization_invitations
                  WHERE role_id = OLD.id AND accepted_at IS NULL) THEN
      RAISE EXCEPTION 'Este rol está asignado a personas o invitaciones. Reasígnalas antes de eliminarlo';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT (NEW.permissions <@ public.org_permission_catalog()) THEN
    RAISE EXCEPTION 'Permiso desconocido en el rol';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  -- Permisos únicos y ordenados según el catálogo.
  NEW.permissions := ARRAY(
    SELECT p FROM unnest(public.org_permission_catalog()) WITH ORDINALITY AS c(p, i)
    WHERE p = ANY(NEW.permissions) ORDER BY i
  );

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id <> OLD.organization_id
     OR NEW.is_system <> OLD.is_system
     OR NEW.system_key IS DISTINCT FROM OLD.system_key THEN
    RAISE EXCEPTION 'Cambio de rol no permitido';
  END IF;
  IF OLD.is_system AND NEW.access_type <> OLD.access_type THEN
    RAISE EXCEPTION 'No se puede cambiar el tipo de acceso de un rol predeterminado';
  END IF;
  IF OLD.system_key = 'admin' THEN
    NEW.permissions := public.org_permission_catalog();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_roles_guard ON public.org_roles;
CREATE TRIGGER org_roles_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_role_change();

-- Si un rol personalizado cambia de tipo de acceso, re-derivar el enum de sus
-- miembros/personal/invitaciones (UPDATE role_id = role_id dispara el sync).
CREATE OR REPLACE FUNCTION public.resync_org_role_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.access_type IS DISTINCT FROM OLD.access_type THEN
    UPDATE public.organization_members     SET role_id = role_id WHERE role_id = NEW.id;
    UPDATE public.staff_members            SET role_id = role_id WHERE role_id = NEW.id;
    UPDATE public.organization_invitations SET role_id = role_id WHERE role_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS org_roles_resync ON public.org_roles;
CREATE TRIGGER org_roles_resync
  AFTER UPDATE OF access_type ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.resync_org_role_members();

-- ── 6. Funciones de capacidad (las que usa toda la RLS) ────────────────────
CREATE OR REPLACE FUNCTION public.get_org_ids_with_permission(p_perm text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.org_roles r     ON r.id = om.role_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND (r.access_type = 'admin' OR p_perm = ANY(r.permissions));
$$;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org uuid, p_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_org IN (SELECT public.get_org_ids_with_permission(p_perm));
$$;

CREATE OR REPLACE FUNCTION public.get_admin_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.org_roles r     ON r.id = om.role_id
  WHERE om.user_id = auth.uid()
    AND r.access_type = 'admin'
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;

CREATE OR REPLACE FUNCTION public.get_scheduler_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('schedule');
$$;

CREATE OR REPLACE FUNCTION public.get_finance_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('billing');
$$;

-- Clínica: permiso 'clinical' o worker con especialidad vet (como antes).
CREATE OR REPLACE FUNCTION public.get_clinical_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('clinical')
  UNION
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.profile_id = auth.uid()
        AND sm.organization_id = om.organization_id
        AND sm.specialty = 'vet'
    );
$$;

-- Report cards: permiso 'report_cards' o worker con especialidad trainer.
CREATE OR REPLACE FUNCTION public.get_reportcard_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('report_cards')
  UNION
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.profile_id = auth.uid()
        AND sm.organization_id = om.organization_id
        AND sm.specialty = 'trainer'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_org_ids_with_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_org_ids()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduler_org_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_writer_org_ids()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinical_writer_org_ids()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reportcard_writer_org_ids()   TO authenticated;

-- ── 7. accept_invitation: respeta el rol personalizado de la invitación ───
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.organization_invitations;
  v_user_id uuid;
  v_user_email text;
  v_slug text;
  v_profile public.profiles;
  v_staff_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.organization_invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;

  -- C1: la invitación solo puede aceptarla el correo destinatario.
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo electrónico';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role_id)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role_id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  -- Vincular ficha de Personal existente por email (case-insensitive).
  UPDATE public.staff_members
  SET profile_id = v_user_id,
      role_id = v_invite.role_id,
      is_active = true,
      updated_at = now()
  WHERE organization_id = v_invite.organization_id
    AND lower(email) = lower(v_invite.email)
    AND profile_id IS NULL
  RETURNING id INTO v_staff_id;

  IF v_staff_id IS NULL THEN
    INSERT INTO public.staff_members (
      organization_id, profile_id, first_name, last_name, email, phone, role_id, is_active
    )
    VALUES (
      v_invite.organization_id,
      v_user_id,
      COALESCE(NULLIF(v_profile.first_name, ''), split_part(v_invite.email, '@', 1)),
      COALESCE(v_profile.last_name, ''),
      v_invite.email,
      COALESCE(v_profile.phone, ''),
      v_invite.role_id,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = v_invite.id;

  SELECT slug INTO v_slug FROM public.organizations WHERE id = v_invite.organization_id;
  RETURN json_build_object('slug', v_slug, 'role', v_invite.role);
END;
$function$;

-- ── 8. get_invitation_by_token: expone el nombre del rol personalizado ────
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT oi.role, r.name AS role_name, oi.email, oi.expires_at, o.name AS org_name
  INTO v_row
  FROM public.organization_invitations oi
  JOIN public.organizations o ON o.id = oi.organization_id
  LEFT JOIN public.org_roles r ON r.id = oi.role_id
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now();

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Never return the token itself — caller already has it
  RETURN json_build_object(
    'role',       v_row.role,
    'role_name',  v_row.role_name,
    'email',      v_row.email,
    'org_name',   v_row.org_name,
    'expires_at', v_row.expires_at
  );
END;
$$;
