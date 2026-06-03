import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Specialty } from "@/lib/worker";

export interface MyStaffMember {
  id: string;
  first_name: string;
  last_name: string;
  specialty: Specialty | null;
  role: string;
}

export function useMyStaffMember() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["my-staff", organization?.id, user?.id],
    enabled: !!organization?.id && !!user?.id,
    queryFn: async (): Promise<MyStaffMember | null> => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, first_name, last_name, specialty, role")
        .eq("organization_id", organization!.id)
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyStaffMember) ?? null;
    },
  });
}
