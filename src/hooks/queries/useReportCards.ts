import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

function reportCardKeys(orgId: string | undefined) {
  return {
    all: ["report-cards", orgId] as const,
    list: (page: number) => ["report-cards", orgId, "list", page] as const,
  };
}

export interface ReportCardFilters {
  page?: number;
  search?: string;
  staffId?: string;
  category?: string;
  status?: "all" | "draft" | "sent";
  dogId?: string;
}

export const REPORT_CARDS_PAGE_SIZE = PAGE_SIZE;

/**
 * Report cards paginados. Los filtros se aplican en el servidor: antes se
 * traían 50 y se filtraba en el navegador, así que con más de 50 registros
 * los filtros y los contadores mentían.
 */
export function useReportCards({ page = 0, search = "", staffId = "all", category = "all", status = "all", dogId }: ReportCardFilters = {}) {
  const { organization } = useOrganization();
  const term = search.trim();

  return useQuery({
    queryKey: [...reportCardKeys(organization?.id).list(page), { term, staffId, category, status, dogId }],
    enabled: !!organization?.id,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from("report_cards")
        .select(`
          *,
          dogs(id, name, photo_url, customers(id, first_name, last_name)),
          staff_members(id, first_name, last_name)
        `, { count: "exact" })
        .eq("organization_id", organization!.id);
      if (term) query = query.ilike("dog_name", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
      if (staffId !== "all") query = query.eq("trainer_id", staffId);
      if (category !== "all") query = query.eq("service_category", category);
      if (status !== "all") query = query.eq("is_sent", status === "sent");
      if (dogId) query = query.eq("dog_id", dogId);
      const { data, error, count } = await query
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      const total = count ?? 0;
      return { cards: data ?? [], total, hasMore: (page + 1) * PAGE_SIZE < total };
    },
  });
}

/** Totales de la org (sin filtros) para el encabezado. */
export function useReportCardStats() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: [...reportCardKeys(organization?.id).all, "stats"],
    enabled: !!organization?.id,
    queryFn: async () => {
      const base = () =>
        supabase.from("report_cards").select("id", { count: "exact", head: true }).eq("organization_id", organization!.id);
      const [all, drafts] = await Promise.all([base(), base().eq("is_sent", false)]);
      if (all.error) throw all.error;
      if (drafts.error) throw drafts.error;
      return { total: all.count ?? 0, drafts: drafts.count ?? 0 };
    },
  });
}

export function useCreateReportCard() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"report_cards">, "organization_id">) => {
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
