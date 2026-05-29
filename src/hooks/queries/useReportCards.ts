import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

function reportCardKeys(orgId: string | undefined) {
  return {
    all: ["report-cards", orgId] as const,
    list: (page: number) => ["report-cards", orgId, "list", page] as const,
  };
}

export function useReportCards({ page = 0 } = {}) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: reportCardKeys(organization?.id).list(page),
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("report_cards")
        .select(`
          *,
          dogs(id, name, photo_url, customers(id, first_name, last_name)),
          staff_members(id, first_name, last_name)
        `, { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("session_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { cards: data ?? [], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

export function useCreateReportCard() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("report_cards")
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportCardKeys(organization?.id).all }),
  });
}
