import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface AppCounts {
  unreadNotices: number;
  pendingRequests: number;
}

export function useAppCounts() {
  const { organization } = useOrganization();
  const [counts, setCounts] = useState<AppCounts>({ unreadNotices: 0, pendingRequests: 0 });

  const fetch = async () => {
    if (!organization) return;
    const [noticesRes, requestsRes] = await Promise.all([
      supabase
        .from("notices")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("is_read", false)
        .eq("is_dismissed", false),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "requested"),
    ]);
    setCounts({
      unreadNotices: noticesRes.count ?? 0,
      pendingRequests: requestsRes.count ?? 0,
    });
  };

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("app-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, fetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  return counts;
}
