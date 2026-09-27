import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { AccessType, OrgPermission, OrgRoleInfo } from "@/lib/permissions";

export interface OrgRoleWithCount extends OrgRoleInfo {
  member_count: number;
}

export interface OrgRoleInput {
  name: string;
  access_type: AccessType;
  permissions: OrgPermission[];
}

function roleKeys(orgId: string | undefined) {
  return { all: ["org_roles", orgId] as const };
}

/** Roles de la org (sistema primero, luego alfabético) con nº de personas asignadas. */
export function useOrgRoles() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: roleKeys(organization?.id).all,
    enabled: !!organization?.id,
    queryFn: async (): Promise<OrgRoleWithCount[]> => {
      const [rolesRes, staffRes] = await Promise.all([
        supabase
          .from("org_roles")
          .select("id, name, access_type, permissions, is_system, system_key")
          .eq("organization_id", organization!.id)
          .order("is_system", { ascending: false })
          .order("name"),
        supabase.from("staff_members").select("role_id").eq("organization_id", organization!.id),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (staffRes.error) throw staffRes.error;
      const counts = new Map<string, number>();
      for (const s of staffRes.data ?? []) {
        if (s.role_id) counts.set(s.role_id, (counts.get(s.role_id) ?? 0) + 1);
      }
      return (rolesRes.data ?? []).map((r) => ({
        ...(r as OrgRoleInfo),
        member_count: counts.get(r.id) ?? 0,
      }));
    },
  });
}

export function useSaveOrgRole() {
  const queryClient = useQueryClient();
  const { organization, refetch } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: OrgRoleInput }) => {
      const query = id
        ? supabase.from("org_roles").update(input).eq("id", id)
        : supabase.from("org_roles").insert({ ...input, organization_id: organization!.id });
      const { error } = await query;
      if (error) {
        if (error.code === "23505") throw new Error("Ya existe un rol con ese nombre");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys(organization?.id).all });
      // El rol propio pudo cambiar (nombre/permisos).
      refetch();
    },
  });
}

export function useDeleteOrgRole() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys(organization?.id).all }),
  });
}
