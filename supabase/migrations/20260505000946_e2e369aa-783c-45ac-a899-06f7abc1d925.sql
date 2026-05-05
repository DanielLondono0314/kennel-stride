CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.organization_invitations;
  v_user_id uuid;
  v_slug text;
  v_profile public.profiles;
  v_staff_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.organization_invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;

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