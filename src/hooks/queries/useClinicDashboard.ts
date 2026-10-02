import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchAll } from "@/lib/supabaseQuery";
import { DEFAULT_DOG_DASHBOARD_CONFIG } from "@/lib/dogDashboardConfig";
import { useDogDashboard, useDogDashboardConfig } from "@/hooks/queries/useDogDashboard";
import { RECENT_DAYS, buildClinicDashboard, type ClinicDogBase, type ClinicRaw } from "@/lib/clinicDashboard";

/** Historia clínica de la org que necesita el panel (solo las columnas usadas). */
function useClinicRaw() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ["clinic-dashboard", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<ClinicRaw> => {
      const since = format(subDays(new Date(), RECENT_DAYS + 1), "yyyy-MM-dd");
      const [consultations, vaccines, dewormings, conditions, medications, welfareRows, items] = await Promise.all([
        fetchAll((f, t) => supabase.from("medical_history")
          .select("id, dog_id, record_date, record_type, reason, diagnosis, veterinarian, next_appointment")
          .eq("organization_id", orgId!).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("vaccination_schedule")
          .select("dog_id, vaccine_name, date_administered, next_dose_date")
          .eq("organization_id", orgId!).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("deworming_records")
          .select("dog_id, product_name, product_type, date_administered, next_dose_date")
          .eq("organization_id", orgId!).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("medical_conditions")
          .select("dog_id, condition_name, status, severity, treatment, diagnosed_date")
          .eq("organization_id", orgId!).neq("status", "resolved").order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("dog_medications")
          .select("dog_id, name, dose, frequency, start_date, end_date")
          .eq("organization_id", orgId!).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("welfare_check_entries")
          .select("dog_id, flags, notes, created_at, tasks!inner(organization_id, status, completed_at, due_at)")
          .eq("tasks.organization_id", orgId!).eq("tasks.status", "done").gte("created_at", since)
          .order("id").range(f, t)),
        supabase.from("welfare_check_items").select("key, label").eq("organization_id", orgId!),
      ]);

      const labels = new Map((items.data ?? []).map((i) => [i.key, i.label]));
      const welfare = (welfareRows as { dog_id: string; flags: unknown; notes: string | null; created_at: string; tasks: { completed_at: string | null; due_at: string | null } | null }[])
        .map((w) => {
          const flags = w.flags && typeof w.flags === "object"
            ? Object.entries(w.flags as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => labels.get(k) ?? k)
            : [];
          return { dog_id: w.dog_id, checked_at: w.tasks?.completed_at ?? w.tasks?.due_at ?? w.created_at, flags, notes: w.notes };
        });

      return {
        consultations: consultations as ClinicRaw["consultations"],
        vaccines: vaccines as ClinicRaw["vaccines"],
        dewormings: dewormings as ClinicRaw["dewormings"],
        conditions: conditions as ClinicRaw["conditions"],
        medications: medications as ClinicRaw["medications"],
        welfare,
      };
    },
  });
}

/**
 * Panel de clínica: los perros activos del Panel de perros (peso, alergias,
 * estancia) más su historia clínica, ya evaluada (alertas, agenda, tratamientos).
 */
export function useClinicDashboard() {
  const configQuery = useDogDashboardConfig();
  const config = configQuery.data ?? DEFAULT_DOG_DASHBOARD_CONFIG;
  const dogsQuery = useDogDashboard(config.weight);
  const rawQuery = useClinicRaw();

  const data = useMemo(() => {
    if (!dogsQuery.data || !rawQuery.data) return null;
    const base: ClinicDogBase[] = dogsQuery.data.dogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      photoUrl: d.photoUrl,
      owner: d.owner,
      inCenter: d.stay.state === "in_center",
      weightStatus: d.weight.status,
      weightChangePct: d.weight.changePct,
      allergies: d.allergies.map((a) => ({ allergen: a.allergen, severity: a.severity })),
      flags: d.flags,
    }));
    return buildClinicDashboard(base, rawQuery.data);
  }, [dogsQuery.data, rawQuery.data]);

  return {
    data,
    isLoading: dogsQuery.isLoading || rawQuery.isLoading,
    isError: dogsQuery.isError || rawQuery.isError,
    isFetching: dogsQuery.isFetching || rawQuery.isFetching,
    refetch: () => Promise.all([dogsQuery.refetch(), rawQuery.refetch()]),
  };
}
