import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/contexts/PlatformAdminContext";
import { getFunctionErrorMessage } from "@/lib/functionError";

export interface PlatformOverviewStats {
  total_organizations: number;
  active_organizations: number;
  trialing_organizations: number;
  cancelled_organizations: number;
  new_organizations_30d: number;
  total_dogs: number;
  total_customers: number;
  total_staff: number;
}

export function usePlatformAdminOverview() {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "overview"],
    enabled: isPlatformAdmin,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_admin_overview_stats");
      if (error) throw error;
      return data as unknown as PlatformOverviewStats;
    },
  });
}

export interface PlatformOrganizationRow {
  id: string;
  slug: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  active_staff_count: number;
  dogs_count: number;
  customers_count: number;
  reservations_count: number;
  campaigns_count: number;
  last_reservation_at: string | null;
}

export function usePlatformAdminOrganizations() {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "organizations"],
    enabled: isPlatformAdmin,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_admin_list_organizations");
      if (error) throw error;
      return (data ?? []) as unknown as PlatformOrganizationRow[];
    },
  });
}

export interface PlatformCreditConsumptionRow {
  organization_id: string;
  name: string;
  slug: string;
  credits_consumed: number;
  deductions_count: number;
}

export function usePlatformAdminCreditConsumption(days: number) {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "credit-consumption", days],
    enabled: isPlatformAdmin,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_admin_credit_consumption", { p_days: days });
      if (error) throw error;
      return (data ?? []) as unknown as PlatformCreditConsumptionRow[];
    },
  });
}

export interface PlatformOrgDetail {
  organization: {
    id: string;
    slug: string;
    name: string;
    subscription_status: string;
    trial_ends_at: string;
    created_at: string;
    ls_customer_id: string | null;
    ls_subscription_id: string | null;
  };
  staff: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
    email: string;
  }>;
  packages: Array<{
    id: string;
    name: string;
    status: string;
    remaining_credits: number;
    total_credits: number;
    expires_at: string;
    created_at: string;
  }>;
  counts: { dogs: number; customers: number; staff: number };
}

export interface PlatformAuditLogRow {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_org_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function usePlatformAdminAuditLog() {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "audit-log"],
    enabled: isPlatformAdmin,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_admin_audit_log")
        .select("id, admin_user_id, action, target_org_id, target_user_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PlatformAuditLogRow[];
    },
  });
}

export function usePlatformAdminOrgDetail(orgId: string | undefined) {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "organization", orgId],
    enabled: isPlatformAdmin && !!orgId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_admin_org_detail", { p_org_id: orgId! });
      if (error) throw error;
      return data as unknown as PlatformOrgDetail;
    },
  });
}

export interface PlatformUserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  memberships: Array<{
    organization_id: string;
    role: string;
    organizations: { name: string; slug: string } | null;
  }>;
}

export function usePlatformAdminUsers() {
  const { isPlatformAdmin } = usePlatformAdmin();
  return useQuery({
    queryKey: ["platform-admin", "users"],
    enabled: isPlatformAdmin,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("platform-admin-users");
      if (error) throw new Error(await getFunctionErrorMessage(error, "Error al cargar usuarios"));
      return (data?.users ?? []) as PlatformUserRow[];
    },
  });
}

export function useAdjustPackageCredits(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ packageId, delta, reason }: { packageId: string; delta: number; reason: string }) => {
      const { data, error } = await supabase.rpc("platform_admin_adjust_package_credits", {
        p_package_id: packageId,
        p_delta: delta,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admin", "organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["platform-admin", "audit-log"] });
    },
  });
}

export function useSetSubscriptionStatus(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason: string }) => {
      const { data, error } = await supabase.rpc("platform_admin_set_subscription_status", {
        p_org_id: orgId!,
        p_status: status,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admin", "organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["platform-admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-admin", "audit-log"] });
    },
  });
}
