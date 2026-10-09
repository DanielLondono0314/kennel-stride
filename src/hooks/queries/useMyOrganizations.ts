import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { orderByLocation, toMyOrganization, type MembershipRow, type MyOrganization } from "@/lib/myOrganizations";

export type { MyOrganization };

/**
 * Centros del usuario actual (una persona puede trabajar para varios: un
 * freelance, o el dueño de varias sedes). La RLS de organization_members solo
 * devuelve las membresías propias.
 */
export async function fetchMyOrganizations(userId: string): Promise<MyOrganization[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, org_roles(name, access_type), organizations!inner(id, slug, name, logo_url, parent_org_id, owner_id)")
    .eq("user_id", userId);
  if (error) throw error;
  const orgs = ((data ?? []) as unknown as MembershipRow[])
    .map((row) => toMyOrganization(row, userId))
    .filter((o): o is MyOrganization => o !== null);
  return orderByLocation(orgs);
}

export function myOrganizationsKey(userId: string | null | undefined) {
  return ["my-organizations", userId] as const;
}

export function useMyOrganizations() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: myOrganizationsKey(userId),
    queryFn: () => fetchMyOrganizations(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Cupo de sedes de la principal de `orgId` (o de la propia principal). Ver get_sede_quota. */
export interface SedeQuota {
  principal_id: string;
  principal_slug: string;
  principal_name: string;
  is_sede: boolean;
  is_owner: boolean;
  used: number;
  max: number;
  can_create: boolean;
  reason: string | null;
}

export function sedeQuotaKey(orgId: string | null | undefined) {
  return ["sede-quota", orgId] as const;
}

export function useSedeQuota(orgId: string | null | undefined) {
  return useQuery({
    queryKey: sedeQuotaKey(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<SedeQuota> => {
      const { data, error } = await supabase.rpc("get_sede_quota", { p_org_id: orgId! });
      if (error) throw error;
      return data as unknown as SedeQuota;
    },
  });
}
