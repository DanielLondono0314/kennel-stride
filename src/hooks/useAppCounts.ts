import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppCounts {
  unreadNotices: number;
  pendingRequests: number;
}

export function useAppCounts() {
  const [counts, setCounts] = useState<AppCounts>({ unreadNotices: 0, pendingRequests: 0 });

  const fetch = async () => {
    const [noticesRes, requestsRes] = await Promise.all([
      supabase
        .from("notices")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("is_dismissed", false),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "requested"),
    ]);
    setCounts({
      unreadNotices: noticesRes.count ?? 0,
      pendingRequests: requestsRes.count ?? 0,
    });
  };

  useEffect(() => {
    fetch();
    // Real-time updates for both tables
    const channel = supabase
      .channel("app-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, fetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return counts;
}
