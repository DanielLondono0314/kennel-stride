import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchAll } from "@/lib/supabaseQuery";
import { isUuid } from "@/lib/ids";
import { readAggression, readFeeding, type Aggression, type Feeding } from "@/lib/dogCare";
import { currentPlan, type DogPlan } from "@/lib/dogPlans";

export interface WorkerDogListItem {
  id: string;
  name: string;
  breed: string;
  gender: string;
  photoUrl: string | null;
  kennelName: string | null;
  inCenter: boolean;
  ownerName: string | null;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
  feeding: Feeding | null;
}

/**
 * Perros de la org para la vista del trabajador. "En el centro" = ocupa una
 * perrera (facility_units.assigned_dog_id), que es lo mismo que usa la ronda
 * de bienestar para saber quién está presente.
 */
export function useWorkerDogs() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["worker-dogs", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<WorkerDogListItem[]> => {
      const [dogs, units] = await Promise.all([
        fetchAll((f, t) =>
          supabase
            .from("dogs")
            .select("id, name, breed, gender, photo_url, is_aggressive, has_allergies, on_medication, feeding, customers(first_name, last_name)")
            .eq("organization_id", orgId!)
            .eq("is_active", true)
            .order("name")
            .range(f, t)
        ),
        fetchAll((f, t) =>
          supabase
            .from("facility_units")
            .select("name, assigned_dog_id")
            .eq("organization_id", orgId!)
            .not("assigned_dog_id", "is", null)
            .range(f, t)
        ),
      ]);
      const kennelByDog = new Map(units.map((u) => [u.assigned_dog_id as string, u.name as string]));
      return dogs.map((d) => ({
        id: d.id,
        name: d.name,
        breed: d.breed,
        gender: d.gender,
        photoUrl: d.photo_url,
        kennelName: kennelByDog.get(d.id) ?? null,
        inCenter: kennelByDog.has(d.id),
        ownerName: d.customers ? `${d.customers.first_name} ${d.customers.last_name}`.trim() : null,
        flags: { aggressive: !!d.is_aggressive, allergies: !!d.has_allergies, medication: !!d.on_medication },
        feeding: readFeeding(d.feeding),
      }));
    },
  });
}

export interface WorkerDogProfile {
  id: string;
  name: string;
  breed: string;
  gender: string;
  birthDate: string | null;
  weight: number | null;
  color: string | null;
  isNeutered: boolean;
  photoUrl: string | null;
  behaviorNotes: string | null;
  medicalNotes: string | null;
  notes: string | null;
  kennelName: string | null;
  owner: { name: string; phone: string | null } | null;
  aggression: Aggression | null;
  feeding: Feeding | null;
  allergies: { id: string; allergen: string; type: string; reaction: string | null; severity: string | null }[];
  medications: { id: string; name: string; dose: string | null; frequency: string | null; route: string | null; withFood: boolean; endDate: string | null }[];
  vaccines: { id: string; name: string; nextDoseDate: string | null }[];
  reports: { id: string; sessionDate: string; serviceType: string; overallScore: number; highlights: string | null; notes: string | null }[];
  /** Plan vigente del perro (qué incluye, hasta cuándo). */
  plan: DogPlan | null;
}

/** Ficha completa de un perro para el trabajador (todo lo que necesita para cuidarlo). */
export function useWorkerDogProfile(dogId: string | null | undefined) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["worker-dog", orgId, dogId],
    enabled: !!orgId && isUuid(dogId),
    queryFn: async (): Promise<WorkerDogProfile | null> => {
      const id = dogId!;
      const [dogRes, allergiesRes, medsRes, vaccRes, unitRes, reportsRes, plansRes] = await Promise.all([
        supabase
          .from("dogs")
          .select("*, customers(first_name, last_name, phone)")
          .eq("id", id)
          .eq("organization_id", orgId!)
          .maybeSingle(),
        supabase.from("dog_allergies").select("id, allergen, type, reaction, severity").eq("dog_id", id).eq("organization_id", orgId!),
        supabase.from("dog_medications").select("id, name, dose, frequency, route, with_food, end_date").eq("dog_id", id).eq("organization_id", orgId!),
        supabase
          .from("vaccination_schedule")
          .select("id, vaccine_name, next_dose_date")
          .eq("dog_id", id)
          .eq("organization_id", orgId!)
          .order("next_dose_date", { ascending: true, nullsFirst: false }),
        supabase.from("facility_units").select("name").eq("assigned_dog_id", id).eq("organization_id", orgId!).maybeSingle(),
        supabase
          .from("report_cards")
          .select("id, session_date, service_type, overall_score, highlights, notes")
          .eq("dog_id", id)
          .eq("organization_id", orgId!)
          .order("session_date", { ascending: false })
          .limit(3),
        supabase.from("dog_plans").select("*").eq("dog_id", id).eq("organization_id", orgId!).eq("status", "active"),
      ]);
      if (dogRes.error) throw dogRes.error;
      const d = dogRes.data;
      if (!d) return null;
      return {
        id: d.id,
        name: d.name,
        breed: d.breed,
        gender: d.gender,
        birthDate: d.birth_date,
        weight: d.weight,
        color: d.color,
        isNeutered: !!d.is_neutered,
        photoUrl: d.photo_url,
        behaviorNotes: d.behavior_notes?.trim() || null,
        medicalNotes: d.medical_notes?.trim() || null,
        notes: d.notes?.trim() || null,
        kennelName: unitRes.data?.name ?? null,
        owner: d.customers ? { name: `${d.customers.first_name} ${d.customers.last_name}`.trim(), phone: d.customers.phone } : null,
        aggression: d.is_aggressive ? readAggression(d.aggression_details) : null,
        feeding: readFeeding(d.feeding),
        allergies: allergiesRes.data ?? [],
        medications: (medsRes.data ?? []).map((m) => ({
          id: m.id, name: m.name, dose: m.dose, frequency: m.frequency, route: m.route, withFood: !!m.with_food, endDate: m.end_date,
        })),
        vaccines: (vaccRes.data ?? []).map((v) => ({ id: v.id, name: v.vaccine_name, nextDoseDate: v.next_dose_date })),
        plan: currentPlan((plansRes.data ?? []) as DogPlan[]),
        reports: (reportsRes.data ?? []).map((r) => ({
          id: r.id, sessionDate: r.session_date, serviceType: r.service_type, overallScore: r.overall_score, highlights: r.highlights, notes: r.notes,
        })),
      };
    },
  });
}
