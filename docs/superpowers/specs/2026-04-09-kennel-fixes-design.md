# KennelOps — 9 Bug Fixes & Improvements
**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

Nine fixes across the kennel management app: two require database migrations (dog characteristics, service types per org), three are pure frontend fixes (breed dropdown, login redirect, mock dog list), and four involve both frontend and backend (kennel unit limit, medical record save, report card photos, employee creation).

---

## Fix 1 — Remove kennel-per-zone limit

**Files:** `src/pages/FacilityPage.tsx`, `src/components/facility/ZoneBlock.tsx`

**Root cause:** `FacilityToolbar.tsx` sets `defaultCapacity: 8` and auto-creates exactly 8 units at zone creation. No mechanism exists to add more units to an existing zone.

**Solution:**
- Add `handleAddUnit(zoneId: string)` in `FacilityPage.tsx` that inserts a single `facility_units` row with the next available `position_index` and `name` (e.g. "Perrera 09").
- Add an "＋" button inside `ZoneBlock.tsx`, visible only for `zone_type === "kennels"`, that calls `onAddUnit(zone.id)`.
- Pass `onAddUnit` as a new prop through `ZoneBlock`.
- No DB migration needed — uses existing `facility_units` table.

---

## Fix 2 — Dog breed searchable dropdown

**Files:** `src/components/dogs/DogModal.tsx`

**Root cause:** The `breed` field is a plain `<Input>`, requiring users to type the breed manually.

**Solution:**
- Replace the `<Input value={breed}...>` with a `Combobox` built from shadcn `Command` + `Popover` components.
- Add a `DOG_BREEDS` constant (same file or `src/lib/constants.ts`) with ~100 common breeds (e.g. Labrador Retriever, Golden Retriever, Pastor Alemán, Bulldog, Poodle, etc.).
- The combobox filters breeds as the user types. If the typed value doesn't match any option, allow saving it as a free-text entry (so uncommon breeds aren't blocked).
- No DB migration needed.

---

## Fix 3 — Dog characteristic icons (Agresivo, Alérgico, Medicamentos)

**Files:** DB migration, `src/components/dogs/DogModal.tsx`, `src/components/dogs/DogCharacteristicIcons.tsx` (new), dog list/profile views

**Root cause:** The `dogs` table has no structured boolean fields for these characteristics.

**DB migration:**
```sql
ALTER TABLE dogs
  ADD COLUMN IF NOT EXISTS is_aggressive  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_allergies  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_medication  boolean NOT NULL DEFAULT false;
```

**Solution:**
- Add a new "Alertas de Comportamiento/Salud" section in `DogModal.tsx` with three `<Switch>` components for the three new fields.
- Create `src/components/dogs/DogCharacteristicIcons.tsx` — a small component that receives the dog object and renders icon badges:
  - `is_aggressive` → `AlertTriangle` icon, red/destructive color, tooltip "Perro agresivo"
  - `has_allergies` → `Leaf` icon, yellow/warning color, tooltip "Tiene alergias"
  - `on_medication` → `Pill` icon, blue/info color, tooltip "En medicación"
- Render this component on dog list rows and dog profile header.
- Manually update `src/integrations/supabase/types.ts`: add `is_aggressive`, `has_allergies`, `on_medication` (all `boolean`) to `dogs.Row`, `dogs.Insert`, and `dogs.Update`.

---

## Fix 4 — Service types customizable per organization

**Files:** DB migration, `src/contexts/OrganizationContext.tsx`, `src/components/settings/BusinessProfileTab.tsx`, `src/components/report-cards/ReportCardModal.tsx`

**Root cause:** `SERVICE_TYPES` is hardcoded in `ReportCardModal.tsx`. Organizations have different services.

**DB migration:**
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS service_types jsonb NOT NULL DEFAULT '[
    {"value":"daycare","label":"Guardería"},
    {"value":"board_and_train","label":"Internado + Entrenamiento"},
    {"value":"training_session","label":"Sesión de Entrenamiento"},
    {"value":"grooming","label":"Grooming"},
    {"value":"evaluation","label":"Evaluación"}
  ]'::jsonb;
```

**Solution:**
- Extend `Organization` interface in `OrganizationContext.tsx` with `service_types: Array<{value: string; label: string}>`.
- Add the field to the `select` query in `OrganizationContext.tsx`.
- Add a "Tipos de Servicio" card in `BusinessProfileTab.tsx`: list existing types, allow adding new (label + auto-slug value) and deleting any. Save updates to `organizations.service_types`.
- In `ReportCardModal.tsx`, replace the hardcoded `SERVICE_TYPES` constant with `organization.service_types` from `useOrganization()`. Fallback to the 5 defaults if the array is empty.

---

## Fix 5 — Login redirects immediately to create-kennel page

**Files:** `src/pages/LoginPage.tsx`

**Root cause:** The `useEffect` in `LoginPage` depends on `[session]` but doesn't guard against the auth `loading` state. When a logged-in user (no org yet) loads the page, `session` becomes non-null before the component can render, and `getFirstOrgSlug()` returns null → redirect to `/onboarding`.

**Solution:**
- Destructure `loading` from `useAuth()` in `LoginPage`.
- Add `if (loading || !session) return;` as the guard in the `useEffect`.
- Add `loading` to the `useEffect` dependency array.
- This ensures the page renders its form before auth state is resolved, preventing a flash redirect on page load.

---

## Fix 6 — Error saving NEW medical record

**Files:** `src/components/clinic/MedicalHistoryTab.tsx`

**Root cause:** The insert payload doesn't include `organization_id`. The `medical_history` table likely has an RLS policy that checks org membership. The error is swallowed silently (no `console.error`).

**Solution:**
- Import `useOrganization` and destructure `organization`.
- Add `console.error(error)` before the toast so the real error is visible during development.
- Add `organization_id: organization!.id` to the insert payload (cast with `as any` since the generated types may be outdated).
- Add the same field to the update payload for consistency.
- `MedicalHistoryTab` props already receive `dogId`/`dogName` — the component is rendered inside `ClinicPage`/`DogProfilePage` which are already wrapped in `OrgGuard`, so `organization` will always be available.

---

## Fix 7 — Report card photo upload fails

**Files:** Supabase migration (storage bucket), `src/components/report-cards/ReportCardModal.tsx`

**Root cause:** The `report-card-photos` storage bucket doesn't exist in Supabase, or its RLS policies don't allow authenticated uploads.

**Solution:**
- Create bucket via Supabase migration or dashboard:
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('report-card-photos', 'report-card-photos', true)
  ON CONFLICT DO NOTHING;
  
  CREATE POLICY "Auth users can upload report card photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'report-card-photos');
  
  CREATE POLICY "Public read report card photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'report-card-photos');
  ```
- In `ReportCardModal.tsx`, improve the error message: include `error.message` in the toast so the user sees what failed.

---

## Fix 8 — Cannot create employee

**Files:** `src/components/settings/StaffManagementTab.tsx`

**Root cause:** The `handleSave` insert to `staff_members` doesn't include `organization_id`. The table has RLS that rejects inserts without it. Additionally, `fetchStaff` queries all staff without org filter, so it either shows all orgs' staff or returns nothing depending on RLS.

**Solution:**
- Import `useOrganization` and destructure `organization`.
- Add `organization_id: organization!.id` to the insert payload (cast with `as any`).
- Add `.eq("organization_id", organization!.id)` filter to `fetchStaff`.
- Gate `fetchStaff` call: `if (!organization) return;`.

---

## Fix 9 — Kennel assignment shows wrong dog list

**Files:** `src/components/facility/KennelAssignmentModal.tsx`, `src/pages/FacilityPage.tsx`

**Root cause:** `KennelAssignmentModal` uses a hardcoded `MOCK_DOGS` array instead of real data.

**Solution:**
- Remove `MOCK_DOGS` from `KennelAssignmentModal.tsx`.
- Add a `dogs` prop: `dogs: Array<{id: string; name: string}>` to the modal's props interface.
- In `FacilityPage.tsx`, fetch dogs on mount in two steps:
  ```ts
  // Step 1: get customer IDs for this org
  const { data: custData } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organization!.id);
  const custIds = custData?.map((c) => c.id) ?? [];

  // Step 2: fetch dogs belonging to those customers
  const { data: dogsData } = await supabase
    .from("dogs")
    .select("id, name")
    .in("customer_id", custIds)
    .order("name");
  ```
- Add `dogs` state (`useState<{id:string;name:string}[]>([])`) and populate it in `fetchData`.
- Pass the fetched dogs array to `<KennelAssignmentModal dogs={dogs} ... />`.

---

## Implementation Order

1. DB migrations first (fixes 3, 4, 7) — unblock the rest
2. Fixes 6, 8 (RLS + org_id) — unblock saving operations  
3. Fix 9 (real dog list) — unblock kennel assignment
4. Fix 1 (add more kennels) — facility UX
5. Fixes 2, 3 frontend (breed combobox, characteristic icons)
6. Fix 4 frontend (service types settings UI)
7. Fix 5 (login redirect guard)

---

## Out of scope

- Changing authentication provider or Supabase RLS policies beyond what's needed for each fix
- New pages or navigation changes
- Internationalization changes
