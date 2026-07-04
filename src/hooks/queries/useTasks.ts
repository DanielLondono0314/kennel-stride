import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function taskKeys(orgId: string | undefined) {
  return {
    all: ["tasks", orgId] as const,
    list: () => ["tasks", orgId, "list"] as const,
  };
}

export function useTasks() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: taskKeys(organization?.id).list(),
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "*, dogs(id, name), facility_zones(id, name), staff_members:assignee_staff_id(id, first_name, last_name)"
        )
        .eq("organization_id", organization!.id)
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskKeys(organization?.id).all }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys(organization?.id).all });
      queryClient.invalidateQueries({ queryKey: ["my-day"] });
    },
  });
}
