-- Fix RLS: replace all anonymous/public policies with authenticated-only policies
-- This prevents unauthenticated users from reading or writing any business data

-- =====================
-- CUSTOMERS
-- =====================
DROP POLICY IF EXISTS "Anon can read customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can update customers" ON public.customers;
DROP POLICY IF EXISTS "Anon can delete customers" ON public.customers;

CREATE POLICY "Authenticated full access customers"
  ON public.customers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- PACKAGES
-- =====================
DROP POLICY IF EXISTS "Anon can read packages" ON public.packages;
DROP POLICY IF EXISTS "Anon can insert packages" ON public.packages;
DROP POLICY IF EXISTS "Anon can update packages" ON public.packages;
DROP POLICY IF EXISTS "Anon can delete packages" ON public.packages;

CREATE POLICY "Authenticated full access packages"
  ON public.packages FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- INVOICES
-- =====================
DROP POLICY IF EXISTS "Anon can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anon can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anon can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anon can delete invoices" ON public.invoices;

CREATE POLICY "Authenticated full access invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- INVOICE ITEMS
-- =====================
DROP POLICY IF EXISTS "Anon can read invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can insert invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can update invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Anon can delete invoice_items" ON public.invoice_items;

CREATE POLICY "Authenticated full access invoice_items"
  ON public.invoice_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- NOTICES
-- =====================
DROP POLICY IF EXISTS "Anon can read notices" ON public.notices;
DROP POLICY IF EXISTS "Anon can insert notices" ON public.notices;
DROP POLICY IF EXISTS "Anon can update notices" ON public.notices;
DROP POLICY IF EXISTS "Anon can delete notices" ON public.notices;

CREATE POLICY "Authenticated full access notices"
  ON public.notices FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- REPORT CARDS
-- =====================
DROP POLICY IF EXISTS "Anon can read report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Anon can insert report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Anon can update report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Anon can delete report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Admins can manage report_cards" ON public.report_cards;

CREATE POLICY "Authenticated full access report_cards"
  ON public.report_cards FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- DOGS
-- =====================
DROP POLICY IF EXISTS "Anon full access dogs" ON public.dogs;

CREATE POLICY "Authenticated full access dogs"
  ON public.dogs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- CLINIC TABLES
-- =====================
DROP POLICY IF EXISTS "Anon full access medical_history" ON public.medical_history;
DROP POLICY IF EXISTS "Anon full access vaccination_schedule" ON public.vaccination_schedule;
DROP POLICY IF EXISTS "Anon full access deworming_records" ON public.deworming_records;
DROP POLICY IF EXISTS "Anon full access medical_conditions" ON public.medical_conditions;
DROP POLICY IF EXISTS "Anon full access dog_temperament" ON public.dog_temperament;

CREATE POLICY "Authenticated full access medical_history"
  ON public.medical_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access vaccination_schedule"
  ON public.vaccination_schedule FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access deworming_records"
  ON public.deworming_records FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access medical_conditions"
  ON public.medical_conditions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access dog_temperament"
  ON public.dog_temperament FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- FACILITY
-- =====================
DROP POLICY IF EXISTS "Anon can read facility_zones" ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can insert facility_zones" ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can update facility_zones" ON public.facility_zones;
DROP POLICY IF EXISTS "Anon can delete facility_zones" ON public.facility_zones;

CREATE POLICY "Authenticated full access facility_zones"
  ON public.facility_zones FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can read facility_units" ON public.facility_units;
DROP POLICY IF EXISTS "Anon can insert facility_units" ON public.facility_units;
DROP POLICY IF EXISTS "Anon can update facility_units" ON public.facility_units;
DROP POLICY IF EXISTS "Anon can delete facility_units" ON public.facility_units;

CREATE POLICY "Authenticated full access facility_units"
  ON public.facility_units FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- CAMPAIGNS
-- =====================
DROP POLICY IF EXISTS "Anon can read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anon can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anon can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Anon can delete campaigns" ON public.campaigns;

CREATE POLICY "Authenticated full access campaigns"
  ON public.campaigns FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- RESERVATIONS
-- =====================
DROP POLICY IF EXISTS "Anon full access reservations" ON public.reservations;

CREATE POLICY "Authenticated full access reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- BUSINESS PROFILE
-- =====================
DROP POLICY IF EXISTS "Anon can read business" ON public.business_profile;
DROP POLICY IF EXISTS "Anon can insert business" ON public.business_profile;
DROP POLICY IF EXISTS "Anon can update business" ON public.business_profile;

-- Keep authenticated read (already exists), add write for authenticated
CREATE POLICY "Authenticated can manage business"
  ON public.business_profile FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================
-- STAFF MEMBERS
-- =====================
DROP POLICY IF EXISTS "Anon can read staff" ON public.staff_members;
DROP POLICY IF EXISTS "Anon can insert staff" ON public.staff_members;
DROP POLICY IF EXISTS "Anon can update staff" ON public.staff_members;
DROP POLICY IF EXISTS "Anon can delete staff" ON public.staff_members;

-- Keep "Authenticated can read staff" and "Admins can manage staff" that already exist

-- =====================
-- STORAGE: report-card-photos
-- =====================
DROP POLICY IF EXISTS "Anyone can upload report photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view report photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete report photos" ON storage.objects;

CREATE POLICY "Authenticated can upload report photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-card-photos');

CREATE POLICY "Authenticated can view report photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-card-photos');

CREATE POLICY "Authenticated can delete report photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-card-photos');
