import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

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
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  /** True when the DB query completed but the slug was not found */
  notFound: boolean;
  isSubscriptionActive: boolean;
  refetch: () => void;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  loading: true,
  notFound: false,
  isSubscriptionActive: false,
  refetch: () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !orgSlug) {
      setLoading(false);
      return;
    }
    load();
  }, [user, orgSlug]);

  async function load() {
    setLoading(true);
    setNotFound(false);
    const { data } = await (supabase as any)
      .from("organizations")
      .select("id, slug, name, logo_url, subscription_status, trial_ends_at, opening_time, closing_time, timezone, address, city, phone, email")
      .eq("slug", orgSlug)
      .maybeSingle();
    if (data) {
      setOrganization(data);
      setNotFound(false);
    } else {
      setOrganization(null);
      setNotFound(true);
    }
    setLoading(false);
  }

  const isSubscriptionActive = organization
    ? organization.subscription_status === "active" ||
      (organization.subscription_status === "trialing" &&
        new Date(organization.trial_ends_at) > new Date())
    : false;

  return (
    <OrganizationContext.Provider value={{ organization, loading, notFound, isSubscriptionActive, refetch: load }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
