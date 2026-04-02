-- Multi-tenant architecture: organizations + organization_members
-- Each kennel center = one organization, isolated by RLS

-- =====================
-- 1. ORGANIZATIONS TABLE
-- =====================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  address text DEFAULT '',
  city text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  opening_time time DEFAULT '07:00',
  closing_time time DEFAULT '19:00',
  timezone text DEFAULT 'America/Mexico_City',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================
-- 2. ORGANIZATION MEMBERS TABLE
-- =====================
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- =====================
-- 3. ADD organization_id TO ALL BUSINESS TABLES
-- =====================
ALTER TABLE public.customers         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.dogs              ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.packages          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.reservations      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.facility_zones    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.facility_units    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.staff_members     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.report_cards      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notices           ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.medical_history   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.vaccination_schedule  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deworming_records     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.medical_conditions   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.dog_temperament      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- =====================
-- 4. INDEXES FOR PERFORMANCE
-- =====================
CREATE INDEX IF NOT EXISTS idx_org_members_user   ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org    ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org      ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_dogs_org           ON public.dogs(organization_id);
CREATE INDEX IF NOT EXISTS idx_packages_org       ON public.packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org       ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org  ON public.invoice_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_reservations_org   ON public.reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_facility_zones_org ON public.facility_zones(organization_id);
CREATE INDEX IF NOT EXISTS idx_facility_units_org ON public.facility_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_org          ON public.staff_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_org   ON public.report_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org      ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_notices_org        ON public.notices(organization_id);

-- =====================
-- 5. HELPER FUNCTION (SECURITY DEFINER to bypass RLS in policies)
-- =====================
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- =====================
-- 6. MIGRATE EXISTING DATA → default org
-- =====================
DO $$
DECLARE
  default_org_id uuid;
  first_user_id uuid;
  org_name text := 'Mi Centro';
  org_slug text;
  bp_name text;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user_id IS NULL THEN RETURN; END IF;

  -- Try to get name from business_profile
  SELECT name INTO bp_name FROM public.business_profile LIMIT 1;
  IF bp_name IS NOT NULL AND bp_name != '' THEN
    org_name := bp_name;
  END IF;

  -- Generate slug from name (lowercase, hyphens, no special chars)
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  org_slug := trim(both '-' from org_slug);
  IF org_slug = '' THEN org_slug := 'mi-centro'; END IF;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Create default org (active forever for existing owner)
  INSERT INTO public.organizations (name, slug, owner_id, subscription_status, trial_ends_at)
  VALUES (org_name, org_slug, first_user_id, 'active', now() + interval '100 years')
  RETURNING id INTO default_org_id;

  -- Add ALL existing users as org admins
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT default_org_id, id, 'admin' FROM auth.users
  ON CONFLICT DO NOTHING;

  -- Assign all existing data to default org
  UPDATE public.customers         SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.dogs              SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.packages          SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.invoices          SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.invoice_items     SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.reservations      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.facility_zones    SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.facility_units    SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.staff_members     SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.report_cards      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.campaigns         SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.notices           SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.medical_history   SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.vaccination_schedule  SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.deworming_records     SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.medical_conditions    SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.dog_temperament       SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;

-- =====================
-- 7. RLS POLICIES — organizations & members
-- =====================
CREATE POLICY "Members can read own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Owner can update org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Authenticated can create org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can read memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Admins can manage memberships"
  ON public.organization_members FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

-- =====================
-- 8. UPDATE RLS ON BUSINESS TABLES — replace "Authenticated full access" with org-scoped
-- =====================
DROP POLICY IF EXISTS "Authenticated full access customers"    ON public.customers;
DROP POLICY IF EXISTS "Authenticated full access dogs"         ON public.dogs;
DROP POLICY IF EXISTS "Authenticated full access packages"     ON public.packages;
DROP POLICY IF EXISTS "Authenticated full access invoices"     ON public.invoices;
DROP POLICY IF EXISTS "Authenticated full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated full access reservations" ON public.reservations;
DROP POLICY IF EXISTS "Authenticated full access facility_zones" ON public.facility_zones;
DROP POLICY IF EXISTS "Authenticated full access facility_units" ON public.facility_units;
DROP POLICY IF EXISTS "Authenticated can read staff"           ON public.staff_members;
DROP POLICY IF EXISTS "Admins can manage staff"               ON public.staff_members;
DROP POLICY IF EXISTS "Authenticated full access report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Authenticated full access campaigns"    ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated full access notices"      ON public.notices;
DROP POLICY IF EXISTS "Authenticated full access medical_history" ON public.medical_history;
DROP POLICY IF EXISTS "Authenticated full access vaccination_schedule" ON public.vaccination_schedule;
DROP POLICY IF EXISTS "Authenticated full access deworming_records" ON public.deworming_records;
DROP POLICY IF EXISTS "Authenticated full access medical_conditions" ON public.medical_conditions;
DROP POLICY IF EXISTS "Authenticated full access dog_temperament" ON public.dog_temperament;
DROP POLICY IF EXISTS "Authenticated can manage business"      ON public.business_profile;

-- Create org-scoped policies for each table
CREATE POLICY "Org members full access customers"
  ON public.customers FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access dogs"
  ON public.dogs FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access packages"
  ON public.packages FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access invoice_items"
  ON public.invoice_items FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access facility_zones"
  ON public.facility_zones FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access facility_units"
  ON public.facility_units FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access staff_members"
  ON public.staff_members FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access report_cards"
  ON public.report_cards FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access campaigns"
  ON public.campaigns FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access notices"
  ON public.notices FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access medical_history"
  ON public.medical_history FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access vaccination_schedule"
  ON public.vaccination_schedule FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access deworming_records"
  ON public.deworming_records FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access medical_conditions"
  ON public.medical_conditions FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members full access dog_temperament"
  ON public.dog_temperament FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

-- business_profile: authenticated can read (still used by settings)
CREATE POLICY "Authenticated can read business"
  ON public.business_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write business"
  ON public.business_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
