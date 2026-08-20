import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface FacilityZoneRow {
  id: string;
  name: string;
}

/** Lista de zonas/áreas de la org — para selects (filtros, asignación de tareas). */
export function useFacilityZones() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["facility-zones", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facility_zones")
        .select("id, name")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FacilityZoneRow[];
    },
  });
}
