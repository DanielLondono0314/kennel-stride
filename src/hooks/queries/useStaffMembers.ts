import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface StaffMemberRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

/** Lista de staff activo de la org — para selects (filtros, asignación). */
export function useStaffMembers() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["staff-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, first_name, last_name, role")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffMemberRow[];
    },
  });
}

/**
 * Todo el personal de la org (activo e inactivo) con sus datos completos. Una
 * sola consulta compartida por la página de Personal y su tabla: antes cada
 * una pedía staff_members por su lado y se repetía en cada re-render (QA E-07).
 */
export function useStaffList() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["staff-members", orgId, "all"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, first_name, last_name, email, phone, role, role_id, is_active, created_at, updated_at, organization_id, profile_id, specialty")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
