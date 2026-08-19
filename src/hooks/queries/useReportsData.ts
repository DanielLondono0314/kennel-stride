import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { subDays, subMonths } from "date-fns";

export type DateRange = "30d" | "90d" | "6m" | "1y";

function getDateFrom(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case "30d": return subDays(now, 30);
    case "90d": return subDays(now, 90);
    case "6m":  return subMonths(now, 6);
    case "1y":  return subMonths(now, 12);
  }
}

function reportsKeys(orgId: string | undefined) {
  return {
    all: ["reports", orgId] as const,
    range: (range: DateRange) => ["reports", orgId, range] as const,
  };
}

export function useReportsData(range: DateRange) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: reportsKeys(organization?.id).range(range),
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const dateFrom = getDateFrom(range).toISOString();
      const orgId = organization!.id;

      const [invR, custR, pkgR, unitR, rcR, resR] = await Promise.all([
        supabase.from("invoices").select("id, total, status, created_at, customer_id, payment_method").eq("organization_id", orgId).gte("created_at", dateFrom),
        supabase.from("customers").select("id, created_at, city").eq("organization_id", orgId).gte("created_at", dateFrom),
        supabase.from("packages").select("id, status, total_credits, remaining_credits, price, created_at, expires_at").eq("organization_id", orgId),
        supabase.from("facility_units").select("id, unit_type, status").eq("organization_id", orgId),
        supabase.from("report_cards").select("id, rating, session_date").eq("organization_id", orgId).gte("session_date", dateFrom),
        supabase.from("reservations").select("id, service_type, status, start_date, total_price, customer_id").eq("organization_id", orgId).gte("start_date", dateFrom),
      ]);

      if (invR.error) throw invR.error;
      if (resR.error) throw resR.error;

      return {
        invoices: invR.data ?? [],
        newCustomers: custR.data ?? [],
        packages: pkgR.data ?? [],
        units: unitR.data ?? [],
        reportCards: rcR.data ?? [],
        reservations: resR.data ?? [],
        dateFrom,
      };
    },
  });
}
