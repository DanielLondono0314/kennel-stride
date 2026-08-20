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
