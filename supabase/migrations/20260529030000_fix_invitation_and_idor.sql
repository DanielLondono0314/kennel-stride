-- supabase/migrations/20260529030000_fix_invitation_and_idor.sql
-- Stream C — Seguridad auth/tenancy (remediación 2026-05-29; ítems C2 y M2 del análisis).
--
-- C1: accept_invitation no validaba que el email del invite coincidiera con el del
--     usuario autenticado. Cualquier usuario que obtuviera un token podía aceptar la
--     invitación y quedar como miembro (potencialmente admin) de una org ajena.
-- C2: get_inactive_customer_ids no verificaba la pertenencia del llamante a
--     p_organization_id → IDOR: un usuario autenticado podía enumerar los IDs de
--     clientes inactivos de cualquier organización pasando su UUID.
--
-- Migración idempotente: ambos objetos se recrean con CREATE OR REPLACE FUNCTION,
-- preservando la lógica vigente (linking de staff en accept_invitation; consulta de
-- inactividad en get_inactive_customer_ids) y añadiendo únicamente los guards de
-- seguridad. No altera firmas, por lo que no requiere regenerar types.ts.

-- =====================================================================
-- C1. accept_invitation: rechazar si el email del invite != email del usuario
-- =====================================================================
-- Recreada COMPLETA a partir de 20260505000946 (versión activa con linking de staff).
-- Único cambio: chequeo de email justo después del IF NOT FOUND del lookup del invite.
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

  -- C1: la invitación solo puede aceptarla el correo destinatario. Sin este guard,
  -- cualquiera con el token quedaría como miembro (potencialmente admin) de otra org.
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo electrónico';
  END IF;

  -- Add to organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Get profile data
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  -- Try to link existing staff record by email (case-insensitive) within the org
  UPDATE public.staff_members
  SET profile_id = v_user_id,
      role = v_invite.role,
      is_active = true,
      updated_at = now()
  WHERE organization_id = v_invite.organization_id
    AND lower(email) = lower(v_invite.email)
    AND profile_id IS NULL
  RETURNING id INTO v_staff_id;

  -- If no staff record matched, create one from profile data
  IF v_staff_id IS NULL THEN
    INSERT INTO public.staff_members (
      organization_id, profile_id, first_name, last_name, email, phone, role, is_active
    )
    VALUES (
      v_invite.organization_id,
      v_user_id,
      COALESCE(NULLIF(v_profile.first_name, ''), split_part(v_invite.email, '@', 1)),
      COALESCE(v_profile.last_name, ''),
      v_invite.email,
      COALESCE(v_profile.phone, ''),
      v_invite.role,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mark invitation as accepted
  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = v_invite.id;

  SELECT slug INTO v_slug FROM public.organizations WHERE id = v_invite.organization_id;
  RETURN json_build_object('slug', v_slug, 'role', v_invite.role);
END;
$function$;

-- =====================================================================
-- C2. get_inactive_customer_ids: guard de pertenencia (cierra IDOR)
-- =====================================================================
-- Recreada a partir de 20260528000004 (misma lógica de inactividad), añadiendo el
-- guard de tenancy en el WHERE. Como es SECURITY DEFINER y service_role no aparece
-- en organization_members, get_user_org_ids() devolvería 0 filas para la edge
-- function. Por eso se permite el bypass cuando auth.uid() IS NULL (contexto
-- service_role / send-campaign), manteniendo el guard para usuarios autenticados.
CREATE OR REPLACE FUNCTION public.get_inactive_customer_ids(
  p_organization_id uuid,
  p_days int DEFAULT 30
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.organization_id = p_organization_id
    -- Guard de tenancy: el usuario debe pertenecer a la org. service_role (edge
    -- function) llega con auth.uid() NULL y omite el guard intencionalmente.
    AND (
      p_organization_id IN (SELECT public.get_user_org_ids())
      OR auth.uid() IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.customer_id = c.id
        AND r.organization_id = p_organization_id
        AND r.status IN ('completed', 'checked_in', 'in_progress')
        AND r.start_date >= (CURRENT_DATE - (p_days || ' days')::interval)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_inactive_customer_ids(uuid, int)
  TO authenticated, service_role;
