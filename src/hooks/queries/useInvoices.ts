import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  payment_method: string | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

function invoiceKeys(orgId: string | undefined) {
  return {
    all: ["invoices", orgId] as const,
    list: (page: number, status: string, search: string) =>
      ["invoices", orgId, "list", page, status, search] as const,
    customers: ["invoices-customers", orgId] as const,
    items: (invoiceId: string) => ["invoice-items", invoiceId] as const,
  };
}

export function useInvoices({ page = 0, status = "all", search = "" } = {}) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: invoiceKeys(organization?.id).list(page, status, search),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`*, customers!inner(id, first_name, last_name, email)`, { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);

      if (search.trim()) {
        query = query.or(
          `invoice_number.ilike.%${search.trim()}%,customers.first_name.ilike.%${search.trim()}%,customers.last_name.ilike.%${search.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const invoices = (data as any[] ?? []).map((inv) => {
        const { customers: c, ...rest } = inv;
        return {
          ...rest,
          customer: c ?? undefined,
        } as InvoiceRow & { customer?: InvoiceCustomer };
      });

      return {
        invoices,
        total: count ?? 0,
        hasMore: invoices.length === PAGE_SIZE,
      };
    },
  });
}

export function useInvoiceCustomers() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: invoiceKeys(organization?.id).customers,
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email")
        .eq("organization_id", organization!.id)
        .order("first_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as InvoiceCustomer[];
    },
  });
}

export function useInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoice-items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId!);
      if (error) throw error;
      return (data ?? []) as InvoiceItemRow[];
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_method: method, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys(organization?.id).all });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys(organization?.id).all });
    },
  });
}
