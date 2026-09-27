import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ilikeAny } from "@/lib/supabaseQuery";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_document: string | null;
  id_document_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  dog_count?: number;
  address_lat?: number | null;
  address_lng?: number | null;
  address_geocoded_at?: string | null;
  notification_channel_override?: "sms" | "whatsapp" | null;
  whatsapp_opt_in?: boolean;
  marketing_opt_out?: boolean;
}

export type CustomerStatusFilter = "active" | "inactive" | "all";

// balance/is_active son opcionales: la DB los default-ea y el formulario no los pide.
export type CreateCustomerInput = Omit<DbCustomer, "id" | "created_at" | "updated_at" | "dog_count" | "balance" | "is_active"> & { balance?: number; is_active?: boolean };
export type UpdateCustomerInput = Partial<CreateCustomerInput>;

function customerKeys(orgId: string | undefined) {
  return {
    all: ["customers", orgId] as const,
    list: (page: number, search: string, status: CustomerStatusFilter) => ["customers", orgId, "list", page, search, status] as const,
    detail: (id: string) => ["customers", orgId, id] as const,
  };
}

export function useCustomers({ page = 0, search = "", status = "active" as CustomerStatusFilter } = {}) {
  const { organization } = useOrganization();
  const keys = customerKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search, status),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*, dogs(id)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("first_name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("is_active", status === "active");

      if (search.trim()) {
        query = query.or(ilikeAny(["first_name", "last_name", "email", "phone"], search));
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const customers = (data ?? []).map((c: any) => ({
        ...c,
        dog_count: c.dogs?.length ?? 0,
        dogs: undefined,
      })) as DbCustomer[];

      return { customers, total: count ?? 0, hasMore: customers.length === PAGE_SIZE };
    },
  });
}

/** Dispara la geocodificación (Mapbox, vía Edge Function) sin bloquear el
 * guardado del cliente — errores se ignoran silenciosamente, el cliente
 * simplemente queda sin lat/lng hasta que se corrija la dirección. */
function triggerGeocode(customerId: string) {
  supabase.functions.invoke("geocode-customer-address", { body: { customerId } }).catch(() => {});
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data, error } = await supabase
        .from("customers")
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data as DbCustomer;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
      if (created.address) triggerGeocode(created.id);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomerInput & { id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .select()
        .single();
      if (error) throw error;
      return data as DbCustomer;
    },
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
      queryClient.setQueryData(customerKeys(organization?.id).detail(updated.id), updated);
      // Solo regeocodificar si el guardado tocó la dirección (evita llamadas
      // innecesarias a Mapbox en cada edición de teléfono/notas/etc).
      if ("address" in variables || "city" in variables || "state" in variables || "zip_code" in variables) {
        triggerGeocode(updated.id);
      }
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
    },
  });
}

export function useBulkDeleteCustomers() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .in("id", ids)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
    },
  });
}

export function useSetCustomersActive() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }) => {
      const { error } = await supabase
        .from("customers")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
    },
  });
}
