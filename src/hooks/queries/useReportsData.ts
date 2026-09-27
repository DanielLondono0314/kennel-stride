import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabaseQuery";
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

      // Paginado: con más de 1000 filas en el rango, PostgREST truncaba y los
      // ingresos/contadores salían por debajo del real sin avisar.
      const [invoices, newCustomers, packages, units, reportCards, reservations] = await Promise.all([
        fetchAll((f, t) => supabase.from("invoices").select("id, total, status, created_at, customer_id, payment_method").eq("organization_id", orgId).gte("created_at", dateFrom).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("customers").select("id, created_at, city").eq("organization_id", orgId).gte("created_at", dateFrom).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("packages").select("id, status, total_credits, remaining_credits, price, created_at, expires_at").eq("organization_id", orgId).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("facility_units").select("id, unit_type, status").eq("organization_id", orgId).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("report_cards").select("id, rating, session_date").eq("organization_id", orgId).gte("session_date", dateFrom).order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("reservations").select("id, service_type, status, start_date, total_price, customer_id").eq("organization_id", orgId).gte("start_date", dateFrom).order("id").range(f, t)),
      ]);

      return {
        invoices,
        newCustomers,
        packages,
        units,
        reportCards,
        reservations,
        dateFrom,
      };
    },
  });
}
