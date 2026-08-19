import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbDog {
  id: string;
  customer_id: string;
  name: string;
  breed: string;
  birth_date: string | null;
  weight: number | null;
  color: string | null;
  gender: string;
  is_neutered: boolean;
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
  microchip_number: string | null;
  notes: string | null;
  behavior_notes: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  aggression_details: unknown | null;
  feeding: unknown | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customers?: { id: string; first_name: string; last_name: string } | null;
}

export type DogStatusFilter = "active" | "inactive" | "all";

function dogKeys(orgId: string | undefined) {
  return {
    all: ["dogs", orgId] as const,
    list: (page: number, search: string, status: DogStatusFilter) => ["dogs", orgId, "list", page, search, status] as const,
    detail: (id: string) => ["dogs", orgId, id] as const,
  };
}

export function useDogs({ page = 0, search = "", status = "active" as DogStatusFilter } = {}) {
  const { organization } = useOrganization();
  const keys = dogKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search, status),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("dogs")
        .select("*, customers(id, first_name, last_name)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("is_active", status === "active");

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,breed.ilike.%${search.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      // cast vía unknown: aggression_details/feeding aún no están en los tipos generados de Supabase.
      return { dogs: (data ?? []) as unknown as DbDog[], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

export function useDeleteDog() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dogs")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dogKeys(organization?.id).all });
    },
  });
}

export function useBulkDeleteDogs() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("dogs")
        .delete()
        .in("id", ids)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dogKeys(organization?.id).all });
    },
  });
}

export function useSetDogsActive() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }) => {
      const { error } = await supabase
        .from("dogs")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dogKeys(organization?.id).all });
    },
  });
}
