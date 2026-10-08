import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toMyOrganization, type MembershipRow, type MyOrganization } from "@/lib/myOrganizations";

export type { MyOrganization };

/**
 * Centros del usuario actual (una persona puede trabajar para varios: un
 * freelance, o el dueño de varias sedes). La RLS de organization_members solo
 * devuelve las membresías propias.
 */
export async function fetchMyOrganizations(userId: string): Promise<MyOrganization[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, org_roles(name, access_type), organizations!inner(slug, name, logo_url)")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as unknown as MembershipRow[])
    .map(toMyOrganization)
    .filter((o): o is MyOrganization => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
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
