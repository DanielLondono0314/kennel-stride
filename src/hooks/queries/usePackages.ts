import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbPackage {
  id: string;
  customer_id: string;
  name: string;
  service_type: string;
  total_credits: number;
  remaining_credits: number;
  price: number;
  purchase_date: string;
  expires_at: string;
  status: string;
  ls_order_id: string | null;
  ls_variant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function packageKeys(orgId: string | undefined) {
  return {
    all: ["packages", orgId] as const,
    list: (page: number, search: string, status: string) =>
      ["packages", orgId, "list", page, search, status] as const,
  };
}

export function usePackages({ page = 0, search = "", status = "all" } = {}) {
  const { organization } = useOrganization();
  const keys = packageKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search, status),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("packages")
        .select(`*, customers(id, first_name, last_name, email, phone)`, { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { packages: (data ?? []) as any[], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

/**
 * Descuento atómico de un crédito vía el RPC `deduct_package_credit`
 * (SECURITY DEFINER). El RPC aplica el piso en 0 (UPDATE ... WHERE
 * remaining_credits > 0) y escribe el log de auditoría en la misma
 * transacción, eliminando el lost-update del read-modify-write en cliente.
 */
export async function deductPackageCredit({ packageId, reason }: { packageId: string; reason?: string }) {
  const { error } = await supabase.rpc("deduct_package_credit" as any, {
    p_package_id: packageId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

export function useDeductCredit() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: deductPackageCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Partial<DbPackage>) => {
      const { data, error } = await supabase
        .from("packages")
        .insert({ ...input, organization_id: organization!.id, remaining_credits: input.total_credits } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}

export function useUpdatePackage() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DbPackage> & { id: string }) => {
      const { data, error } = await supabase
        .from("packages")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}
