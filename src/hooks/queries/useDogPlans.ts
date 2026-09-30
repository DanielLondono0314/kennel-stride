import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchAll } from "@/lib/supabaseQuery";
import type { DogPlan } from "@/lib/dogPlans";

const keys = (orgId: string | undefined) => ({
  all: ["dog-plans", orgId] as const,
  byDog: (dogId: string) => ["dog-plans", orgId, "dog", dogId] as const,
  byDogs: (ids: string[]) => ["dog-plans", orgId, "dogs", ids.join(",")] as const,
  active: () => ["dog-plans", orgId, "active"] as const,
});

/** Todos los planes de un perro, el más reciente primero. */
export function useDogPlans(dogId: string | null | undefined) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: keys(orgId).byDog(dogId ?? ""),
    enabled: !!orgId && !!dogId,
    queryFn: async (): Promise<DogPlan[]> => {
      const { data, error } = await supabase
        .from("dog_plans")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("dog_id", dogId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DogPlan[];
    },
  });
}

/** Planes de varios perros (p. ej. todos los perros de un cliente). */
export function usePlansForDogs(dogIds: string[]) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: keys(orgId).byDogs(dogIds),
    enabled: !!orgId && dogIds.length > 0,
    queryFn: async (): Promise<DogPlan[]> => {
      const { data, error } = await supabase
        .from("dog_plans")
        .select("*")
        .eq("organization_id", orgId!)
        .in("dog_id", dogIds)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DogPlan[];
    },
  });
}

/** Planes activos de la org (para el Panel de perros). */
export function useActiveDogPlans() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: keys(orgId).active(),
    enabled: !!orgId,
    queryFn: async (): Promise<DogPlan[]> =>
      (await fetchAll((f, t) =>
        supabase.from("dog_plans").select("*").eq("organization_id", orgId!).eq("status", "active").range(f, t)
      )) as DogPlan[],
  });
}

export type NewDogPlan = Omit<DogPlan, "id" | "customer_id" | "status" | "ended_at" | "created_at">;

export function usePlanActions() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys(orgId).all });
    queryClient.invalidateQueries({ queryKey: ["dog-dashboard", orgId] });
    queryClient.invalidateQueries({ queryKey: ["worker-dog", orgId] });
  };

  const create = useMutation({
    mutationFn: async (plan: NewDogPlan) => {
      const { data, error } = await supabase
        .from("dog_plans")
        .insert({ ...plan, organization_id: orgId! })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });

  const end = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "finished" | "cancelled" }) => {
      const { error } = await supabase
        .from("dog_plans")
        .update({ status, ended_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const registerUsage = useMutation({
    mutationFn: async ({ id, quantity, usedOn, note }: { id: string; quantity: number; usedOn?: string; note?: string }) => {
      const { data, error } = await supabase.rpc("register_plan_usage", {
        p_plan_id: id,
        p_quantity: quantity,
        p_used_on: usedOn,
        p_note: note,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: invalidate,
  });

  return { create, end, registerUsage };
}
