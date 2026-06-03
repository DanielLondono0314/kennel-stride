import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  subscription_status: string;
  trial_ends_at: string;
  opening_time: string | null;
  closing_time: string | null;
  timezone: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  service_types: Array<{ value: string; label: string }>;
}

export type OrgRole = "admin" | "manager" | "front_desk" | "worker";

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  /** True when the DB query completed but the slug was not found */
  notFound: boolean;
  /** True when the DB query returned an error (network / schema issue) */
  loadError: boolean;
  isSubscriptionActive: boolean;
  /** Role of the currently authenticated user in this org */
  currentUserRole: OrgRole | null;
  /** True only if current user is an admin of this org */
  isAdmin: boolean;
  refetch: () => void;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  loading: true,
  notFound: false,
  loadError: false,
  isSubscriptionActive: false,
  currentUserRole: null,
  isAdmin: false,
  refetch: () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user || !orgSlug) {
      setLoading(false);
      return;
    }
    load();
  }, [user, orgSlug]);

  async function load() {
    if (!orgSlug || !user) return;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);

    // Load org + current user's role in one round-trip
    const [orgResult, memberResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, slug, name, logo_url, subscription_status, trial_ends_at, opening_time, closing_time, timezone, address, city, phone, email, service_types")
        .eq("slug", orgSlug)
        .maybeSingle(),
      user
        ? supabase
            .from("organization_members")
            .select("role, organizations!inner(slug)")
            .eq("user_id", user.id)
            .eq("organizations.slug", orgSlug)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (orgResult.error) {
      toast.error("Error al cargar la organización. Verifica tu conexión.");
      setOrganization(null);
      setNotFound(false);
      setLoadError(true);
      setCurrentUserRole(null);
    } else if (orgResult.data) {
      setOrganization(orgResult.data as Organization);
      setNotFound(false);
      setCurrentUserRole(((memberResult.data as { role?: string } | null)?.role as OrgRole) ?? null);
    } else {
      setOrganization(null);
      setNotFound(true);
      setCurrentUserRole(null);
    }
    setLoading(false);
  }

  const isSubscriptionActive = organization
    ? organization.subscription_status === "active" ||
      (organization.subscription_status === "trialing" &&
        new Date(organization.trial_ends_at) > new Date())
    : false;

  const isAdmin = currentUserRole === "admin";

  return (
    <OrganizationContext.Provider value={{ organization, loading, notFound, loadError, isSubscriptionActive, currentUserRole, isAdmin, refetch: load }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
