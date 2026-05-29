import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Notice, NoticeSeverity } from "@/types";

function noticeKeys(orgId: string | undefined) {
  return {
    all: ["notices", orgId] as const,
    active: ["notices", orgId, "active"] as const,
  };
}

function mapDbNotice(n: any): Notice {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    severity: (n.severity as NoticeSeverity) ?? NoticeSeverity.INFO,
    isRead: n.is_read ?? false,
    entityType: n.entity_type ?? "customer",
    entityId: n.entity_id ?? "",
    suggestedActions: n.suggested_actions ?? [],
    createdAt: new Date(n.created_at),
  };
}

export function useNotices() {
  const { organization } = useOrganization();
  const keys = noticeKeys(organization?.id);

  return useQuery({
    queryKey: keys.active,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("id, title, message, severity, is_read, entity_type, entity_id, suggested_actions, created_at")
        .eq("organization_id", organization!.id)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(mapDbNotice);
    },
  });
}

export function useDismissNotice() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").update({ is_dismissed: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: noticeKeys(organization?.id).active });
      const prev = queryClient.getQueryData<Notice[]>(noticeKeys(organization?.id).active);
      queryClient.setQueryData(
        noticeKeys(organization?.id).active,
        (old: Notice[] | undefined) => (old ?? []).filter((n) => n.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(noticeKeys(organization?.id).active, ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys(organization?.id).all });
    },
  });
}

export function useMarkNoticeRead() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: noticeKeys(organization?.id).active });
      const prev = queryClient.getQueryData<Notice[]>(noticeKeys(organization?.id).active);
      queryClient.setQueryData(
        noticeKeys(organization?.id).active,
        (old: Notice[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(noticeKeys(organization?.id).active, ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys(organization?.id).all });
    },
  });
}

export function useMarkAllNoticesRead() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notices")
        .update({ is_read: true })
        .eq("organization_id", organization!.id)
        .eq("is_dismissed", false)
        .eq("is_read", false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: noticeKeys(organization?.id).active });
      const prev = queryClient.getQueryData<Notice[]>(noticeKeys(organization?.id).active);
      queryClient.setQueryData(
        noticeKeys(organization?.id).active,
        (old: Notice[] | undefined) => (old ?? []).map((n) => ({ ...n, isRead: true }))
      );
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      queryClient.setQueryData(noticeKeys(organization?.id).active, ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys(organization?.id).all });
    },
  });
}

export function useNoticesRealtime() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel(`notices-realtime-${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notices",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notices", organization.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organization?.id, queryClient]);
}
