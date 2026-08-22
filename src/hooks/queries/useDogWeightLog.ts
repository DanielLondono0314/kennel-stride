import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface WeightEntry {
  id: string;
  source: "log" | "medical";
  date: string; // yyyy-MM-dd
  weight: number;
  notes: string | null;
}

function weightKeys(dogId: string | undefined) {
  return {
    all: ["dog-weight-log", dogId] as const,
  };
}

/**
 * Hoja de pesos de un perro: combina los registros dedicados
 * (dog_weight_logs, pesadas rápidas sin necesidad de una consulta) con el
 * campo `weight` de Historial Médico (medical_history) cuando se capturó ahí
 * — así la gráfica muestra la tendencia completa, no solo lo nuevo.
 */
export function useDogWeightLog(dogId: string | undefined) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: weightKeys(dogId),
    enabled: !!dogId && !!orgId,
    queryFn: async (): Promise<WeightEntry[]> => {
      const [logsRes, medicalRes] = await Promise.all([
        supabase
          .from("dog_weight_logs")
          .select("id, recorded_at, weight, notes")
          .eq("dog_id", dogId!)
          .eq("organization_id", orgId!),
        supabase
          .from("medical_history")
          .select("id, record_date, weight")
          .eq("dog_id", dogId!)
          .eq("organization_id", orgId!)
          .not("weight", "is", null),
      ]);
      if (logsRes.error) throw logsRes.error;
      if (medicalRes.error) throw medicalRes.error;

      const logEntries: WeightEntry[] = (logsRes.data ?? []).map((r) => ({
        id: r.id,
        source: "log",
        date: r.recorded_at,
        weight: Number(r.weight),
        notes: r.notes,
      }));

      const medicalEntries: WeightEntry[] = (medicalRes.data ?? []).map((r) => ({
        id: r.id,
        source: "medical",
        date: r.record_date,
        weight: Number(r.weight),
        notes: "Registrado en Historial Médico",
      }));

      return [...logEntries, ...medicalEntries].sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useAddWeightLog(dogId: string | undefined) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: { weight: number; recorded_at: string; notes?: string }) => {
      if (!dogId || !organization) throw new Error("Falta el perro o la organización");
      const { error } = await supabase.from("dog_weight_logs").insert({
        dog_id: dogId,
        organization_id: organization.id,
        weight: input.weight,
        recorded_at: input.recorded_at,
        notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: weightKeys(dogId).all }),
  });
}

export function useDeleteWeightLog(dogId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dog_weight_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: weightKeys(dogId).all }),
  });
}
