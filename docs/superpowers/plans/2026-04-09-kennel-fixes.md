# KennelOps — 9 Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 reported bugs spanning DB migrations, missing organization_id in RLS-protected inserts, hardcoded mock data, missing UI features, and an auth redirect race condition.

**Architecture:** Three DB migrations unlock the rest. Each fix is isolated to 1–3 files. No new routes or pages. Tasks are ordered so later ones don't block on earlier ones.

**Tech Stack:** React 18, TypeScript, Supabase (PostgreSQL + Storage), shadcn/ui (Radix + Tailwind), Vitest

---

## File Map

### Created
- `src/components/dogs/DogCharacteristicIcons.tsx`

### Modified
- `src/integrations/supabase/types.ts` — dogs Row/Insert/Update new fields
- `src/contexts/OrganizationContext.tsx` — service_types in org interface + select
- `src/lib/constants.ts` — DOG_BREEDS list
- `src/components/dogs/DogModal.tsx` — breed combobox + characteristic switches
- `src/pages/DogsPage.tsx` — icons on list rows + new fields in handleSave
- `src/pages/DogProfilePage.tsx` — icons in header + new fields in handleSave
- `src/components/facility/ZoneBlock.tsx` — "+ Agregar perrera" button
- `src/pages/FacilityPage.tsx` — handleAddUnit + fetch real dogs + pass dogs prop
- `src/components/facility/KennelAssignmentModal.tsx` — remove MOCK_DOGS, add dogs prop
- `src/pages/LoginPage.tsx` — loading guard in redirect useEffect
- `src/components/clinic/MedicalHistoryTab.tsx` — org_id + error logging
- `src/components/settings/StaffManagementTab.tsx` — org_id in insert + filter fetch
- `src/components/settings/BusinessProfileTab.tsx` — service types management card
- `src/components/report-cards/ReportCardModal.tsx` — read org service_types

---

## Task 1: DB Migration — Dog characteristics columns

**Files:**
- SQL: Supabase dashboard → SQL Editor
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Run migration**

Open Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
ALTER TABLE dogs
  ADD COLUMN IF NOT EXISTS is_aggressive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_allergies  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_medication  boolean NOT NULL DEFAULT false;
```

Expected output: "Success. No rows returned."

- [ ] **Step 2: Update TypeScript types — dogs.Row**

In `src/integrations/supabase/types.ts`, find the `dogs:` block (around line 284). In the `Row:` section, after `is_neutered: boolean`, add:

```typescript
          is_aggressive: boolean
          has_allergies: boolean
          on_medication: boolean
```

- [ ] **Step 3: Update TypeScript types — dogs.Insert and dogs.Update**

In `dogs.Insert` (after `is_neutered?: boolean`) add:
```typescript
          is_aggressive?: boolean
          has_allergies?: boolean
          on_medication?: boolean
```

In `dogs.Update` (after `is_neutered?: boolean`) add:
```typescript
          is_aggressive?: boolean
          has_allergies?: boolean
          on_medication?: boolean
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors about dogs.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add is_aggressive, has_allergies, on_medication columns to dogs"
```

---

## Task 2: DB Migration — service_types per organization

**Files:**
- SQL: Supabase dashboard
- Modify: `src/contexts/OrganizationContext.tsx`

- [ ] **Step 1: Run migration**

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

Expected: "Success. No rows returned."

- [ ] **Step 2: Add service_types to Organization interface**

In `src/contexts/OrganizationContext.tsx`, replace the `Organization` interface:

```typescript
export interface Organization {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  subscription_status: string;
  trial_ends_at: string;
  opening_time: string | null;
  closing_time: string | null;
  timezone: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  service_types: Array<{ value: string; label: string }>;
}
```

- [ ] **Step 3: Add service_types to the select query**

In `src/contexts/OrganizationContext.tsx`, in the `load()` function, find the organizations select and add `service_types` to the field list:

```typescript
      (supabase as any)
        .from("organizations")
        .select("id, slug, name, logo_url, subscription_status, trial_ends_at, opening_time, closing_time, timezone, address, city, phone, email, service_types")
        .eq("slug", orgSlug)
        .maybeSingle(),
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/contexts/OrganizationContext.tsx
git commit -m "feat: expose service_types from organization context"
```

---

## Task 3: DB Migration — report-card-photos storage bucket

**Files:**
- SQL: Supabase dashboard
- Modify: `src/components/report-cards/ReportCardModal.tsx`

- [ ] **Step 1: Create bucket and policies**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-card-photos', 'report-card-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Auth users can upload report card photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-card-photos');

CREATE POLICY IF NOT EXISTS "Public read report card photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-card-photos');

CREATE POLICY IF NOT EXISTS "Auth users can delete report card photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-card-photos');
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Improve error message in ReportCardModal**

In `src/components/report-cards/ReportCardModal.tsx`, find the upload error handler (around line 153) and replace:

```typescript
      if (error) {
        toast.error(`Error subiendo ${file.name}`);
        continue;
      }
```

with:

```typescript
      if (error) {
        toast.error(`Error subiendo ${file.name}: ${error.message}`);
        console.error("Photo upload error:", error);
        continue;
      }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/report-cards/ReportCardModal.tsx
git commit -m "fix: create report-card-photos bucket and improve upload error messages"
```

---

## Task 4: Fix employee creation — missing organization_id

**Files:**
- Modify: `src/components/settings/StaffManagementTab.tsx`

- [ ] **Step 1: Add useOrganization import**

In `src/components/settings/StaffManagementTab.tsx`, add to the existing imports:

```typescript
import { useOrganization } from "@/contexts/OrganizationContext";
```

- [ ] **Step 2: Destructure organization inside the component**

After `const [saving, setSaving] = useState(false);`, add:

```typescript
  const { organization } = useOrganization();
```

- [ ] **Step 3: Replace fetchStaff with org-filtered version**

Replace the entire `fetchStaff` function:

```typescript
  const fetchStaff = async () => {
    if (!organization) return;
    const { data, error } = await (supabase as any)
      .from("staff_members")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Error al cargar personal");
      console.error(error);
    } else {
      setStaff(data || []);
    }
    setLoading(false);
  };
```

- [ ] **Step 4: Update useEffect dependency**

Replace:
```typescript
  useEffect(() => { fetchStaff(); }, []);
```

with:
```typescript
  useEffect(() => { fetchStaff(); }, [organization?.id]);
```

- [ ] **Step 5: Add organization_id to insert**

In `handleSave`, find the `else` branch (new employee) and replace the insert:

```typescript
    } else {
      const { error } = await (supabase as any)
        .from("staff_members")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role,
          is_active: isActive,
          organization_id: organization!.id,
        });
      if (error) { toast.error("Error al crear"); console.error(error); }
      else { toast.success("Empleado creado"); }
    }
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/StaffManagementTab.tsx
git commit -m "fix: add organization_id to staff_members insert and filter fetch by org"
```

---

## Task 5: Fix medical record save — missing organization_id + error logging

**Files:**
- Modify: `src/components/clinic/MedicalHistoryTab.tsx`

- [ ] **Step 1: Add useOrganization import**

In `src/components/clinic/MedicalHistoryTab.tsx`, add import:

```typescript
import { useOrganization } from "@/contexts/OrganizationContext";
```

- [ ] **Step 2: Destructure organization**

After the existing `useState` declarations, add:

```typescript
  const { organization } = useOrganization();
```

- [ ] **Step 3: Replace handleSave with version that includes organization_id and logs errors**

Replace the entire `handleSave` function:

```typescript
  const handleSave = async () => {
    const payload = {
      dog_id: dogId,
      dog_name: dogName,
      organization_id: organization?.id,
      record_date: form.record_date,
      record_type: form.record_type,
      veterinarian: form.veterinarian,
      reason: form.reason,
      diagnosis: form.diagnosis,
      treatment: form.treatment,
      prescription: form.prescription,
      weight: form.weight ? parseFloat(form.weight) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      heart_rate: form.heart_rate ? parseInt(form.heart_rate) : null,
      respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate) : null,
      blood_pressure: form.blood_pressure,
      body_condition_score: form.body_condition_score ? parseInt(form.body_condition_score) : null,
      notes: form.notes,
      next_appointment: form.next_appointment || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await (supabase as any).from("medical_history").update(payload).eq("id", editingId)
      : await (supabase as any).from("medical_history").insert(payload);
    if (error) {
      console.error("Medical history save error:", error);
      toast.error(`Error al guardar: ${error.message}`);
      return;
    }
    toast.success(editingId ? "Registro actualizado" : "Registro guardado");
    setModalOpen(false);
    fetchRecords();
  };
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/components/clinic/MedicalHistoryTab.tsx
git commit -m "fix: add organization_id and error logging to medical history save"
```

---

## Task 6: Fix kennel assignment — replace MOCK_DOGS with real data

**Files:**
- Modify: `src/components/facility/KennelAssignmentModal.tsx`
- Modify: `src/pages/FacilityPage.tsx`

- [ ] **Step 1: Remove MOCK_DOGS and add dogs prop to KennelAssignmentModal**

In `src/components/facility/KennelAssignmentModal.tsx`:

Delete lines 44–54 (the entire `MOCK_DOGS` constant).

Replace the `KennelAssignmentModalProps` interface with:

```typescript
interface KennelAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: UnitData | null;
  dogs: Array<{ id: string; name: string }>;
  onAssign: (unitId: string, data: {
    assigned_dog_id: string;
    assigned_dog_name: string;
    assignment_start: string;
    assignment_end: string;
    notes: string;
    status: string;
  }) => void;
  onRelease: (unitId: string) => void;
  onSetMaintenance: (unitId: string) => void;
}
```

- [ ] **Step 2: Update function signature and internal references**

Update the function signature to include `dogs`:

```typescript
export function KennelAssignmentModal({
  open, onOpenChange, unit, dogs, onAssign, onRelease, onSetMaintenance,
}: KennelAssignmentModalProps) {
```

In `handleAssign`, replace `MOCK_DOGS.find(...)` with `dogs.find(...)`:

```typescript
    const dog = dogs.find((d) => d.id === dogId);
```

In the JSX `<SelectContent>`, replace `{MOCK_DOGS.map(...)}` with `{dogs.map(...)}`:

```typescript
                <SelectContent>
                  {dogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
```

- [ ] **Step 3: Add dogs state to FacilityPage**

In `src/pages/FacilityPage.tsx`, add state after the existing declarations:

```typescript
  const [dogs, setDogs] = useState<Array<{ id: string; name: string }>>([]);
```

- [ ] **Step 4: Fetch dogs inside fetchData**

In `src/pages/FacilityPage.tsx`, replace the entire `fetchData` function:

```typescript
  const fetchData = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    const [zRes, uRes] = await Promise.all([
      supabase.from("facility_zones").select("*").eq("organization_id", organization!.id).order("sort_order"),
      supabase.from("facility_units").select("*").eq("organization_id", organization!.id).order("position_index"),
    ]);
    if (zRes.data) setZones(zRes.data);
    if (uRes.data) setUnits(uRes.data);

    // Fetch dogs for kennel assignment
    const { data: custData } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organization!.id);
    const custIds = (custData ?? []).map((c: { id: string }) => c.id);
    if (custIds.length > 0) {
      const { data: dogsData } = await supabase
        .from("dogs")
        .select("id, name")
        .in("customer_id", custIds)
        .order("name");
      if (dogsData) setDogs(dogsData as Array<{ id: string; name: string }>);
    }

    setLoading(false);
  }, [organization?.id]);
```

- [ ] **Step 5: Pass dogs to KennelAssignmentModal**

Find `<KennelAssignmentModal` in `FacilityPage.tsx` JSX and update it to:

```typescript
      <KennelAssignmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        unit={selectedUnit}
        dogs={dogs}
        onAssign={handleAssign}
        onRelease={handleRelease}
        onSetMaintenance={handleSetMaintenance}
      />
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/facility/KennelAssignmentModal.tsx src/pages/FacilityPage.tsx
git commit -m "fix: replace MOCK_DOGS with real dogs from Supabase in kennel assignment"
```

---

## Task 7: Fix login redirect race condition

**Files:**
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Add loading to useAuth destructuring**

In `src/pages/LoginPage.tsx`, change line ~32:

```typescript
  const { session, loading } = useAuth();
```

- [ ] **Step 2: Replace redirect useEffect**

Replace the existing `useEffect` (lines ~42–55):

```typescript
  useEffect(() => {
    if (loading || !session) return;
    (async () => {
      if (invite) {
        const result = await acceptInviteAndNavigate(invite, navigate);
        if (result) {
          navigate(`/${result.slug}/dashboard`, { replace: true });
          return;
        }
      }
      const slug = await getFirstOrgSlug(session.user.id);
      navigate(slug ? `/${slug}/dashboard` : "/onboarding", { replace: true });
    })();
  }, [session, loading]);
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "fix: guard login redirect until auth loading is fully resolved"
```

---

## Task 8: Allow adding more kennels to an existing zone

**Files:**
- Modify: `src/components/facility/ZoneBlock.tsx`
- Modify: `src/pages/FacilityPage.tsx`

- [ ] **Step 1: Add onAddUnit prop to ZoneBlock**

In `src/components/facility/ZoneBlock.tsx`, update `ZoneBlockProps`:

```typescript
interface ZoneBlockProps {
  zone: ZoneData;
  units: FacilityUnit[];
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUnitClick: (unit: any) => void;
  onAddUnit: (zoneId: string) => void;
}
```

Update function signature:

```typescript
export function ZoneBlock({ zone, units, onMove, onResize, onDelete, onRename, onUnitClick, onAddUnit }: ZoneBlockProps) {
```

- [ ] **Step 2: Add "+ Agregar perrera" button in kennel content area**

In `ZoneBlock.tsx`, find the `{/* Content */}` section. Replace the kennels branch:

```typescript
        {zone.zone_type === "kennels" ? (
          <div>
            <KennelGrid units={units} onUnitClick={onUnitClick} />
            <button
              onClick={(e) => { e.stopPropagation(); onAddUnit(zone.id); }}
              className="mt-1 w-full text-[9px] text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded px-1 py-0.5 transition-colors"
            >
              + Agregar perrera
            </button>
          </div>
        ) : (
```

- [ ] **Step 3: Add handleAddUnit to FacilityPage**

In `src/pages/FacilityPage.tsx`, add after `handleSetMaintenance`:

```typescript
  // Add a single kennel unit to an existing zone
  const handleAddUnit = async (zoneId: string) => {
    if (!organization) return;
    const zoneUnits = units.filter((u) => u.zone_id === zoneId);
    const nextIndex = zoneUnits.length;
    const nextName = `Perrera ${String(nextIndex + 1).padStart(2, "0")}`;
    const { error } = await supabase.from("facility_units").insert({
      zone_id: zoneId,
      name: nextName,
      unit_type: "kennel",
      position_index: nextIndex,
      status: "available",
      organization_id: organization!.id,
    });
    if (error) {
      toast({ title: "Error al agregar perrera", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
    toast({ title: "Perrera agregada", description: nextName });
  };
```

- [ ] **Step 4: Pass onAddUnit to ZoneBlock**

In `FacilityPage.tsx` JSX, update the `zones.map(...)` render:

```typescript
            {zones.map((zone) => (
              <ZoneBlock
                key={zone.id}
                zone={zone}
                units={units.filter((u) => u.zone_id === zone.id)}
                onMove={handleMoveZone}
                onResize={handleResizeZone}
                onDelete={handleDeleteZone}
                onRename={handleRenameZone}
                onUnitClick={handleUnitClick}
                onAddUnit={handleAddUnit}
              />
            ))}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/components/facility/ZoneBlock.tsx src/pages/FacilityPage.tsx
git commit -m "feat: add button to append kennels to existing kennel zone"
```

---

## Task 9: Dog breed searchable combobox

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/dogs/DogModal.tsx`

- [ ] **Step 1: Add DOG_BREEDS to constants**

In `src/lib/constants.ts`, append at the end of the file:

```typescript
export const DOG_BREEDS = [
  "Affenpinscher", "Akita", "Alaskan Malamute", "American Bulldog",
  "American Staffordshire Terrier", "Basenji", "Basset Hound",
  "Beagle", "Bichon Frisé", "Border Collie", "Boston Terrier",
  "Boxer", "Braco Alemán", "Bulldog Francés", "Bulldog Inglés",
  "Bull Terrier", "Cane Corso", "Caniche", "Cavalier King Charles Spaniel",
  "Chihuahua", "Chow Chow", "Cocker Spaniel", "Dachshund",
  "Dálmata", "Dobermann", "Dogo Argentino", "Dogo de Burdeos",
  "English Springer Spaniel", "Fox Terrier", "Golden Retriever",
  "Gran Danés", "Greyhound", "Husky Siberiano", "Jack Russell Terrier",
  "Labrador Retriever", "Lhasa Apso", "Malinois Belga", "Maltés",
  "Mastín", "Mastín Napolitano", "Mestizo", "Miniature Schnauzer",
  "Papillón", "Pastor Alemán", "Pastor Australiano", "Pastor Bernés",
  "Pastor de Shetland", "Pekinés", "Pit Bull Terrier", "Pointer",
  "Pomerania", "Poodle", "Pug", "Rottweiler", "Rough Collie",
  "Saluki", "Samoyedo", "Schnauzer", "Setter Irlandés", "Shiba Inu",
  "Shih Tzu", "Staffordshire Bull Terrier", "Teckel", "Terranova",
  "Vizsla", "Weimaraner", "West Highland Terrier", "Whippet",
  "Yorkshire Terrier",
].sort();
```

- [ ] **Step 2: Add imports to DogModal**

In `src/components/dogs/DogModal.tsx`, add to existing imports:

```typescript
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DOG_BREEDS } from "@/lib/constants";
```

Note: `Popover`/`PopoverContent`/`PopoverTrigger` are already imported — only add the ones that aren't already there.

- [ ] **Step 3: Add breedOpen state**

After `const [breed, setBreed] = useState("");`, add:

```typescript
  const [breedOpen, setBreedOpen] = useState(false);
```

- [ ] **Step 4: Reset breedOpen when modal opens/closes**

In the `useEffect` that populates/resets the form (the one depending on `[dog, preselectedCustomerId, open]`), add `setBreedOpen(false);` at the end of both the `if (dog)` branch and the `else` branch.

- [ ] **Step 5: Replace breed Input with Combobox**

Find the breed field in the JSX (the `<Input value={breed}...>` inside the `grid grid-cols-2` div). Replace the entire `<div className="space-y-2">` that contains the breed input:

```tsx
            <div className="space-y-2">
              <Label>Raza *</Label>
              <Popover open={breedOpen} onOpenChange={setBreedOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={breedOpen}
                    className="w-full justify-between font-normal text-left"
                  >
                    <span className="truncate">{breed || "Seleccionar raza..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar raza..."
                      value={breed}
                      onValueChange={setBreed}
                    />
                    <CommandEmpty>
                      <p className="text-xs text-muted-foreground px-3 py-2">
                        No encontrada — se guardará "{breed}".
                      </p>
                    </CommandEmpty>
                    <CommandGroup className="max-h-52 overflow-auto">
                      {DOG_BREEDS.filter((b) =>
                        b.toLowerCase().includes((breed ?? "").toLowerCase())
                      ).map((b) => (
                        <CommandItem
                          key={b}
                          value={b}
                          onSelect={(val) => {
                            setBreed(val);
                            setBreedOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", breed === b ? "opacity-100" : "opacity-0")} />
                          {b}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/components/dogs/DogModal.tsx
git commit -m "feat: replace breed text input with searchable combobox with 70 breeds"
```

---

## Task 10: Dog characteristic icons (aggressive, allergies, medication)

**Files:**
- Create: `src/components/dogs/DogCharacteristicIcons.tsx`
- Modify: `src/components/dogs/DogModal.tsx`
- Modify: `src/pages/DogsPage.tsx`
- Modify: `src/pages/DogProfilePage.tsx`

- [ ] **Step 1: Create DogCharacteristicIcons component**

Create `src/components/dogs/DogCharacteristicIcons.tsx`:

```typescript
import { AlertTriangle, Leaf, Pill } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  isAggressive?: boolean | null;
  hasAllergies?: boolean | null;
  onMedication?: boolean | null;
  size?: "sm" | "md";
}

export function DogCharacteristicIcons({ isAggressive, hasAllergies, onMedication, size = "sm" }: Props) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!isAggressive && !hasAllergies && !onMedication) return null;

  return (
    <div className="flex items-center gap-1">
      {isAggressive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-destructive/10 text-destructive"
            )}>
              <AlertTriangle className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Perro agresivo</TooltipContent>
        </Tooltip>
      )}
      {hasAllergies && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-yellow-500/10 text-yellow-600"
            )}>
              <Leaf className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Tiene alergias</TooltipContent>
        </Tooltip>
      )}
      {onMedication && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-blue-500/10 text-blue-600"
            )}>
              <Pill className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>En medicación</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add 3 state variables to DogModal**

In `src/components/dogs/DogModal.tsx`, after `const [isNeutered, setIsNeutered] = useState(false);`:

```typescript
  const [isAggressive, setIsAggressive] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [onMedication, setOnMedication] = useState(false);
```

- [ ] **Step 3: Populate from dog data in useEffect**

In the `if (dog)` branch, after `setIsNeutered(dog.is_neutered);`:

```typescript
      setIsAggressive(dog.is_aggressive ?? false);
      setHasAllergies(dog.has_allergies ?? false);
      setOnMedication(dog.on_medication ?? false);
```

In the `else` branch, after `setIsNeutered(false);`:

```typescript
      setIsAggressive(false);
      setHasAllergies(false);
      setOnMedication(false);
```

- [ ] **Step 4: Include new fields in onSave payload**

In `handleSubmit`, inside the `onSave({...})` call, add:

```typescript
      is_aggressive: isAggressive,
      has_allergies: hasAllergies,
      on_medication: onMedication,
```

- [ ] **Step 5: Add "Alertas" section to DogModal JSX**

Add imports to DogModal:
```typescript
import { AlertTriangle, Leaf, Pill } from "lucide-react";
```

After the `<div className="flex items-center gap-3">` div that contains the neutered Switch, add a new section:

```tsx
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Alertas de comportamiento/salud</Label>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch checked={isAggressive} onCheckedChange={setIsAggressive} />
                <Label className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Perro agresivo
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={hasAllergies} onCheckedChange={setHasAllergies} />
                <Label className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-yellow-600">
                  <Leaf className="h-4 w-4" /> Tiene alergias
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={onMedication} onCheckedChange={setOnMedication} />
                <Label className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-blue-600">
                  <Pill className="h-4 w-4" /> En medicación
                </Label>
              </div>
            </div>
          </div>
```

- [ ] **Step 6: Add icons and new fields to DogsPage**

In `src/pages/DogsPage.tsx`:

**a) Update DbDog interface** — add after `is_neutered: boolean`:
```typescript
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
```

**b) Add import:**
```typescript
import { DogCharacteristicIcons } from "@/components/dogs/DogCharacteristicIcons";
```

**c) Add icons in the desktop table row** — find the block that renders `<p className="font-medium">{dog.name}</p>` (around line 206). After that `<p>`, add:
```tsx
                      <DogCharacteristicIcons
                        isAggressive={dog.is_aggressive}
                        hasAllergies={dog.has_allergies}
                        onMedication={dog.on_medication}
                      />
```

**d) Add icons in the mobile card list** — find `<p className="font-medium truncate">{dog.name}</p>` (around line 263). After that `<p>`, add:
```tsx
                    <DogCharacteristicIcons
                      isAggressive={dog.is_aggressive}
                      hasAllergies={dog.has_allergies}
                      onMedication={dog.on_medication}
                    />
```

**e) Update handleSave payload** — add the three new fields inside the `payload` object:
```typescript
      is_aggressive: data.is_aggressive ?? false,
      has_allergies: data.has_allergies ?? false,
      on_medication: data.on_medication ?? false,
```

- [ ] **Step 7: Add icons and new fields to DogProfilePage**

In `src/pages/DogProfilePage.tsx`:

**a) Update DbDog interface** — add after `is_neutered: boolean`:
```typescript
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
```

**b) Add import:**
```typescript
import { DogCharacteristicIcons } from "@/components/dogs/DogCharacteristicIcons";
```

**c) Add icons in the header** — find the `<div className="flex flex-wrap gap-2 mt-2">` block (around line 186) that contains the gender/neutered badges. After the closing `</div>` of that flex-wrap div, add:
```tsx
              <DogCharacteristicIcons
                isAggressive={dog.is_aggressive}
                hasAllergies={dog.has_allergies}
                onMedication={dog.on_medication}
                size="md"
              />
```

**d) Update handleSave payload** — add the three new fields:
```typescript
      is_aggressive: data.is_aggressive ?? false,
      has_allergies: data.has_allergies ?? false,
      on_medication: data.on_medication ?? false,
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 9: Commit**

```bash
git add src/components/dogs/DogCharacteristicIcons.tsx src/components/dogs/DogModal.tsx src/pages/DogsPage.tsx src/pages/DogProfilePage.tsx
git commit -m "feat: dog characteristic icons for aggressive, allergies, medication"
```

---

## Task 11: Service types per organization — settings UI + consumption

**Files:**
- Modify: `src/components/settings/BusinessProfileTab.tsx`
- Modify: `src/components/report-cards/ReportCardModal.tsx`

- [ ] **Step 1: Update OrgFields interface in BusinessProfileTab**

In `src/components/settings/BusinessProfileTab.tsx`, update the `OrgFields` interface:

```typescript
interface OrgFields {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  opening_time: string;
  closing_time: string;
  timezone: string;
  service_types: Array<{ value: string; label: string }>;
}
```

- [ ] **Step 2: Add newServiceLabel state**

After `const [saving, setSaving] = useState(false);`, add:

```typescript
  const [newServiceLabel, setNewServiceLabel] = useState("");
```

- [ ] **Step 3: Populate service_types in useEffect**

In the `setFields({...})` call inside `useEffect`, add:

```typescript
      service_types: organization.service_types?.length
        ? organization.service_types
        : [
            { value: "daycare", label: "Guardería" },
            { value: "board_and_train", label: "Internado + Entrenamiento" },
            { value: "training_session", label: "Sesión de Entrenamiento" },
            { value: "grooming", label: "Grooming" },
            { value: "evaluation", label: "Evaluación" },
          ],
```

- [ ] **Step 4: Include service_types in handleSave**

In `handleSave`, inside the `.update({...})` object, add:

```typescript
        service_types: fields.service_types,
```

- [ ] **Step 5: Add service types card to JSX**

In `BusinessProfileTab.tsx`, after the closing `</Card>` of the "Horarios de Operación" card and before the save button `<div>`, add:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Servicio</CardTitle>
          <CardDescription>
            Personaliza los servicios que ofrece tu centro. Se usan en report cards y reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {fields.service_types.map((st, i) => (
              <div
                key={st.value}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
              >
                <span className="text-sm">{st.label}</span>
                {isAdmin && fields.service_types.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() =>
                      setFields((prev) =>
                        prev
                          ? { ...prev, service_types: prev.service_types.filter((_, idx) => idx !== i) }
                          : null
                      )
                    }
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Input
                placeholder="Nuevo servicio (ej. Spa canino)"
                value={newServiceLabel}
                onChange={(e) => setNewServiceLabel(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newServiceLabel.trim()) return;
                    const slug = newServiceLabel
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_+|_+$/g, "");
                    setFields((prev) =>
                      prev
                        ? {
                            ...prev,
                            service_types: [
                              ...prev.service_types,
                              { value: slug, label: newServiceLabel.trim() },
                            ],
                          }
                        : null
                    );
                    setNewServiceLabel("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newServiceLabel.trim()}
                onClick={() => {
                  if (!newServiceLabel.trim()) return;
                  const slug = newServiceLabel
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "");
                  setFields((prev) =>
                    prev
                      ? {
                          ...prev,
                          service_types: [
                            ...prev.service_types,
                            { value: slug, label: newServiceLabel.trim() },
                          ],
                        }
                      : null
                  );
                  setNewServiceLabel("");
                }}
              >
                Agregar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 6: Read org service_types in ReportCardModal**

In `src/components/report-cards/ReportCardModal.tsx`:

**a) Add import:**
```typescript
import { useOrganization } from "@/contexts/OrganizationContext";
```

**b) Remove the hardcoded `SERVICE_TYPES` constant** (lines 50–56).

**c) Inside the `ReportCardModal` function**, add after the existing `const { organization }` (or add it if it isn't there):

```typescript
  const { organization } = useOrganization();
  const SERVICE_TYPES = organization?.service_types?.length
    ? organization.service_types
    : [
        { value: "daycare", label: "Guardería" },
        { value: "board_and_train", label: "Internado + Entrenamiento" },
        { value: "training_session", label: "Sesión de Entrenamiento" },
        { value: "grooming", label: "Grooming" },
        { value: "evaluation", label: "Evaluación" },
      ];
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/BusinessProfileTab.tsx src/components/report-cards/ReportCardModal.tsx
git commit -m "feat: service types configurable per organization via settings"
```

---

## Self-Review Checklist (completed)

- [x] Fix 1 (kennel limit) → Task 8
- [x] Fix 2 (breed dropdown) → Task 9
- [x] Fix 3 (dog icons) → Tasks 1 + 10
- [x] Fix 4 (service types per company) → Tasks 2 + 11
- [x] Fix 5 (login redirect) → Task 7
- [x] Fix 6 (medical record save) → Task 5
- [x] Fix 7 (report card photos) → Task 3
- [x] Fix 8 (employee creation) → Task 4
- [x] Fix 9 (kennel dog list) → Task 6
- [x] No TBD/TODO placeholders
- [x] Type names consistent across all tasks (DbDog, Organization, etc.)
- [x] All code blocks complete — no "implement similar to above"
