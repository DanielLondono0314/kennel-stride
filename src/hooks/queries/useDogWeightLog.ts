import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface WeightEntry {
  id: string;
  source: "log" | "medical";
  date: string; // yyyy-MM-dd
  weight: number;
  notes: string | null;
  /** Condición corporal 1-9 (escala WSAVA). */
  bodyConditionScore: number | null;
  /** Nombre de quien registró la pesada (null si no se conoce). */
  recordedBy: string | null;
  /** Momento exacto de captura (para auditoría). */
  createdAt: string;
}

function weightKeys(dogId: string | undefined) {
  return {
    all: ["dog-weight-log", dogId] as const,
  };
}

/** Mapa user_id → "Nombre Apellido" a partir del personal de la org. */
export async function fetchStaffNamesByUserId(orgId: string, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("staff_members")
    .select("profile_id, first_name, last_name")
    .eq("organization_id", orgId)
    .in("profile_id", ids);
  if (error) throw error;
  return new Map(
    (data ?? [])
      .filter((s) => s.profile_id)
      .map((s) => [s.profile_id as string, `${s.first_name} ${s.last_name}`.trim()]),
  );
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
    queryKey: weightKeys(dogId).all,
    enabled: !!dogId && !!orgId,
    queryFn: async (): Promise<WeightEntry[]> => {
      const [logsRes, medicalRes] = await Promise.all([
        supabase
          .from("dog_weight_logs")
          .select("id, recorded_at, weight, notes, body_condition_score, created_by, created_at")
          .eq("dog_id", dogId!)
          .eq("organization_id", orgId!),
        supabase
          .from("medical_history")
          .select("id, record_date, weight, body_condition_score, veterinarian, created_at")
          .eq("dog_id", dogId!)
          .eq("organization_id", orgId!)
          .not("weight", "is", null),
      ]);
      if (logsRes.error) throw logsRes.error;
      if (medicalRes.error) throw medicalRes.error;

      const names = await fetchStaffNamesByUserId(
        orgId!,
        (logsRes.data ?? []).map((r) => r.created_by).filter((v): v is string => !!v),
      );

      const logEntries: WeightEntry[] = (logsRes.data ?? []).map((r) => ({
        id: r.id,
        source: "log",
        date: r.recorded_at,
        weight: Number(r.weight),
        notes: r.notes,
        bodyConditionScore: r.body_condition_score,
        recordedBy: r.created_by ? names.get(r.created_by) ?? null : null,
        createdAt: r.created_at,
      }));

      const medicalEntries: WeightEntry[] = (medicalRes.data ?? []).map((r) => ({
        id: r.id,
        source: "medical",
        date: r.record_date,
        weight: Number(r.weight),
        notes: "Registrado en Historial Médico",
        bodyConditionScore: r.body_condition_score,
        recordedBy: r.veterinarian,
        createdAt: r.created_at,
      }));

      return [...logEntries, ...medicalEntries].sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      );
    },
  });
}

/** Tras cambiar una pesada se refrescan la hoja, el panel y la ficha (dogs.weight lo sincroniza un trigger). */
function invalidateWeightViews(queryClient: ReturnType<typeof useQueryClient>, dogId: string | undefined, orgId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: weightKeys(dogId).all });
  queryClient.invalidateQueries({ queryKey: ["dog-dashboard", orgId] });
  queryClient.invalidateQueries({ queryKey: ["dogs", orgId] });
}

export interface NewWeightInput {
  weight: number;
  recorded_at: string;
  notes?: string;
  body_condition_score?: number | null;
}

export function useAddWeightLog(dogId: string | undefined) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: NewWeightInput) => {
      if (!dogId || !organization) throw new Error("Falta el perro o la organización");
      // created_by lo sella el trigger stamp_dog_weight_log con auth.uid().
      const { error } = await supabase.from("dog_weight_logs").insert({
        dog_id: dogId,
        organization_id: organization.id,
        weight: input.weight,
        recorded_at: input.recorded_at,
        notes: input.notes || null,
        body_condition_score: input.body_condition_score ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateWeightViews(queryClient, dogId, organization?.id),
  });
}

export function useDeleteWeightLog(dogId: string | undefined) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dog_weight_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateWeightViews(queryClient, dogId, organization?.id),
  });
}

/**
 * Último peso de dog_weight_logs, sin el historial médico (que un worker
 * puede no tener permiso de leer). Lo usa la app del worker para advertir
 * errores de captura al pesar.
 */
export function useLatestDogWeight(dogId: string | null | undefined) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: [...weightKeys(dogId ?? undefined).all, "latest"] as const,
    enabled: !!dogId && !!orgId,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("dog_weight_logs")
        .select("weight")
        .eq("dog_id", dogId!)
        .eq("organization_id", orgId!)
        .order("recorded_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.weight) : null;
    },
  });
}
