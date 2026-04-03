-- =====================================================================
-- SECURITY HARDENING — KennelOps multi-tenant
-- Fixes 5 critical vulnerabilities found in security audit
-- =====================================================================

-- =====================================================================
-- 1. FIX: organization_invitations — remove USING(true) that leaks all
--    invitation tokens to any authenticated user.
--    Replace with a SECURITY DEFINER function that accepts a token and
--    returns only that invitation's safe details (no token in response).
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.organization_invitations;
-- Anon users now have NO direct SELECT access to the invitations table.
-- Use get_invitation_by_token() function instead (see JoinPage).

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT oi.role, oi.email, oi.expires_at, o.name AS org_name
  INTO v_row
  FROM public.organization_invitations oi
  JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.token = p_token
    AND oi.accepted_at IS NULL
    AND oi.expires_at > now();

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Never return the token itself — caller already has it
  RETURN json_build_object(
    'role',       v_row.role,
    'email',      v_row.email,
    'org_name',   v_row.org_name,
    'expires_at', v_row.expires_at
  );
END;
$$;

-- Allow anon + authenticated to call this function
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- =====================================================================
-- 2. FIX: organization_invitations — restrict management to admins only
--    (previously any org member could create/delete invitations)
-- =====================================================================
DROP POLICY IF EXISTS "Org members can manage invitations" ON public.organization_invitations;

CREATE POLICY "Admins can manage invitations"
  ON public.organization_invitations FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- =====================================================================
-- 3. FIX: organization_members — only admins can add/change/remove members
--    (previously any member could self-promote or add arbitrary members)
-- =====================================================================
DROP POLICY IF EXISTS "Members can read memberships"  ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.organization_members;

-- Any member can see the full member list for their org (read-only)
CREATE POLICY "Members can view memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Only admins can insert / update / delete memberships
CREATE POLICY "Admins can manage memberships"
  ON public.organization_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id          = auth.uid()
        AND om.organization_id  = organization_members.organization_id
        AND om.role             = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id          = auth.uid()
        AND om.organization_id  = organization_members.organization_id
        AND om.role             = 'admin'
    )
  );

-- =====================================================================
-- 4. FIX: business_profile — add organization_id + org-scoped RLS
--    (previously any authenticated user could read/write ALL orgs' profiles)
-- =====================================================================
ALTER TABLE public.business_profile
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Assign any unassigned rows to the earliest org (migration safety)
UPDATE public.business_profile
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

DROP POLICY IF EXISTS "Authenticated can read business"  ON public.business_profile;
DROP POLICY IF EXISTS "Authenticated can write business" ON public.business_profile;

CREATE POLICY "Org members can access business profile"
  ON public.business_profile FOR ALL TO authenticated
  USING    (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

-- =====================================================================
-- 5. FIX: organizations UPDATE — allow all admins, not just the owner
--    (previously non-owner admins couldn't save business settings)
-- =====================================================================
DROP POLICY IF EXISTS "Owner can update org" ON public.organizations;

CREATE POLICY "Admins can update org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- =====================================================================
-- 6. DEFENSE-IN-DEPTH: ensure stripe fields are never readable via
--    the standard organizations SELECT (they are internal/backend-only).
--    We revoke column-level SELECT on stripe fields for the client role.
--    (Supabase uses the "authenticated" role for client queries)
-- =====================================================================
-- NOTE: Supabase JS client uses the anon/authenticated role.
-- Stripe fields should only be read by service_role (Edge Functions).
REVOKE SELECT (stripe_customer_id, stripe_subscription_id)
  ON public.organizations FROM authenticated, anon;

-- =====================================================================
-- 7. CLEANUP: Drop all legacy USING(true) / anon-access policies from
--    the earliest single-tenant migrations. These were superseded by
--    org-scoped policies in 20260402000001 but never explicitly removed.
--    Any policy below that doesn't exist will be silently skipped.
-- =====================================================================
-- customers
DROP POLICY IF EXISTS "Anon can read customers"    ON public.customers;
DROP POLICY IF EXISTS "Anon can insert customers"  ON public.customers;
DROP POLICY IF EXISTS "Anon can update customers"  ON public.customers;
DROP POLICY IF EXISTS "Anon can delete customers"  ON public.customers;
-- packages
DROP POLICY IF EXISTS "Anon can read packages"    ON public.packages;
DROP POLICY IF EXISTS "Anon can insert packages"  ON public.packages;
DROP POLICY IF EXISTS "Anon can update packages"  ON public.packages;
DROP POLICY IF EXISTS "Anon can delete packages"  ON public.packages;
-- invoices
DROP POLICY IF EXISTS "Anon can read invoices"    ON public.invoices;
DROP POLICY IF EXISTS "Anon can insert invoices"  ON public.invoices;
DROP POLICY IF EXISTS "Anon can update invoices"  ON public.invoices;
DROP POLICY IF EXISTS "Anon can delete invoices"  ON public.invoices;
-- invoice_items
DROP POLICY IF EXISTS "Anon can read invoice_items"    ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can insert invoice_items"  ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can update invoice_items"  ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can delete invoice_items"  ON public.invoice_items;
-- notices
DROP POLICY IF EXISTS "Anon can read notices"    ON public.notices;
DROP POLICY IF EXISTS "Anon can insert notices"  ON public.notices;
DROP POLICY IF EXISTS "Anon can update notices"  ON public.notices;
DROP POLICY IF EXISTS "Anon can delete notices"  ON public.notices;
-- campaigns
DROP POLICY IF EXISTS "Anon can read campaigns"    ON public.campaigns;
DROP POLICY IF EXISTS "Anon can insert campaigns"  ON public.campaigns;
DROP POLICY IF EXISTS "Anon can update campaigns"  ON public.campaigns;
DROP POLICY IF EXISTS "Anon can delete campaigns"  ON public.campaigns;
-- facility_zones
DROP POLICY IF EXISTS "Anon can read facility_zones"    ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can insert facility_zones"  ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can update facility_zones"  ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can delete facility_zones"  ON public.facility_zones;
-- facility_units
DROP POLICY IF EXISTS "Anon can read facility_units"    ON public.facility_units;
DROP POLICY IF EXISTS "Anon can insert facility_units"  ON public.facility_units;
DROP POLICY IF EXISTS "Anon can update facility_units"  ON public.facility_units;
DROP POLICY IF EXISTS "Anon can delete facility_units"  ON public.facility_units;
-- dogs
DROP POLICY IF EXISTS "Anon full access dogs"              ON public.dogs;
-- report_cards
DROP POLICY IF EXISTS "Anon can read report_cards"    ON public.report_cards;
DROP POLICY IF EXISTS "Anon can insert report_cards"  ON public.report_cards;
DROP POLICY IF EXISTS "Anon can update report_cards"  ON public.report_cards;
DROP POLICY IF EXISTS "Anon can delete report_cards"  ON public.report_cards;
-- medical / clinical tables
DROP POLICY IF EXISTS "Anon full access medical_history"        ON public.medical_history;
DROP POLICY IF EXISTS "Anon full access vaccination_schedule"   ON public.vaccination_schedule;
DROP POLICY IF EXISTS "Anon full access deworming_records"      ON public.deworming_records;
DROP POLICY IF EXISTS "Anon full access medical_conditions"     ON public.medical_conditions;
DROP POLICY IF EXISTS "Anon full access dog_temperament"        ON public.dog_temperament;
-- reservations
DROP POLICY IF EXISTS "Anon full access reservations"           ON public.reservations;
-- business_profile legacy
DROP POLICY IF EXISTS "Authenticated can manage business"       ON public.business_profile;
-- staff_members legacy (from 20260331000002)
DROP POLICY IF EXISTS "Authenticated can read staff"  ON public.staff_members;
DROP POLICY IF EXISTS "Admins can manage staff"       ON public.staff_members;
