import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function campaignKeys(orgId: string | undefined) {
  return {
    all: ["campaigns", orgId] as const,
    list: ["campaigns", orgId, "list"] as const,
  };
}

export function useCampaigns() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: campaignKeys(organization?.id).list,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, description, segment_type, channel, scheduled_at, sent_at, status, stats_sent, stats_delivered, stats_opened, stats_clicked, created_at, message_template")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...input, organization_id: organization!.id, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys(organization?.id).all }),
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys(organization?.id).all }),
  });
}
