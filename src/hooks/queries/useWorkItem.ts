import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface WorkItem {
  kind: "task" | "reservation";
  id: string;
  title: string;
  status: string;
  dogId: string | null;
  dogName: string | null;
  serviceType: string | null;
  time: string | null;
  notes: string | null;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
}

/** Loads a single reservation or task (with dog info + alert flags) for the detail page. */
export function useWorkItem(kind: "task" | "reservation", id: string | undefined) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["work-item", kind, organization?.id, id],
    enabled: !!organization?.id && !!id,
    queryFn: async (): Promise<WorkItem | null> => {
      const orgId = organization!.id;
      if (kind === "reservation") {
        const { data, error } = await supabase
          .from("reservations")
          .select(
            "id, service_name, service_type, status, start_date, notes, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)"
          )
          .eq("organization_id", orgId)
          .eq("id", id!)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const d = data;
        return {
          kind: "reservation",
          id: d.id,
          title: d.service_name,
          status: d.status,
          dogId: d.dog_id,
          dogName: d.dogs?.name ?? null,
          serviceType: d.service_type,
          time: d.start_date,
          notes: d.notes,
          flags: {
            aggressive: !!d.dogs?.is_aggressive,
            allergies: !!d.dogs?.has_allergies,
            medication: !!d.dogs?.on_medication,
          },
        };
      }

      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, type, status, due_at, notes, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)"
        )
        .eq("organization_id", orgId)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = data;
      return {
        kind: "task",
        id: d.id,
        title: d.title,
        status: d.status,
        dogId: d.dog_id,
        dogName: d.dogs?.name ?? null,
        serviceType: null,
        time: d.due_at,
        notes: d.notes,
        flags: {
          aggressive: !!d.dogs?.is_aggressive,
          allergies: !!d.dogs?.has_allergies,
          medication: !!d.dogs?.on_medication,
        },
      };
    },
  });
}
