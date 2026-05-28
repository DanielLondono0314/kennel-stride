-- pgcrypto is required for gen_random_bytes() used in token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organization invitations: allows admins to invite team members by email
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'admin',
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Anyone can read invitation by token"  ON public.organization_invitations;

CREATE POLICY "Org members can manage invitations"
  ON public.organization_invitations FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Anyone can read invitation by token"
  ON public.organization_invitations FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  public.organization_invitations;
  v_user_id uuid;
  v_slug    text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = v_invite.id;

  SELECT slug INTO v_slug FROM public.organizations WHERE id = v_invite.organization_id;

  RETURN json_build_object('slug', v_slug, 'role', v_invite.role);
END;
$$;
