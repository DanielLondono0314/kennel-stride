import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";
import { type Feature, type PlanTier, isPlanTier, planHasFeature } from "@/lib/plans";
import type { OrgRoleInfo } from "@/lib/permissions";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  subscription_status: string;
  plan_tier: PlanTier;
  trial_ends_at: string;
  opening_time: string | null;
  closing_time: string | null;
  timezone: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  service_types: Array<{ value: string; label: string }>;
  route_notifications_enabled: boolean;
  route_notification_channel: "sms" | "whatsapp";
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
  /** Plan contratado por la organización (Esencial/Pro/Premium) */
  planTier: PlanTier;
  /** True si el plan de la org incluye el módulo (o si el usuario es platform admin) */
  hasFeature: (feature: Feature) => boolean;
  /** Role of the currently authenticated user in this org */
  currentUserRole: OrgRole | null;
  /** Rol personalizado del usuario en esta org (nombre, tipo de acceso, permisos) */
  currentRole: OrgRoleInfo | null;
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
  planTier: "basic",
  hasFeature: () => false,
  currentUserRole: null,
  currentRole: null,
  isAdmin: false,
  refetch: () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrgRole | null>(null);
  const [currentRole, setCurrentRole] = useState<OrgRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Los platform admins (equipo KennelStride) ven todas las features en cualquier org.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!orgSlug || !user) return;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);

    // Load org + current user's role in one round-trip
    const [orgResult, memberResult, platformAdminResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, slug, name, logo_url, subscription_status, plan_tier, trial_ends_at, opening_time, closing_time, timezone, address, city, phone, email, service_types, route_notifications_enabled, route_notification_channel")
        .eq("slug", orgSlug)
        .maybeSingle(),
      user
        ? supabase
            .from("organization_members")
            .select("role, org_roles(id, name, access_type, permissions, is_system, system_key), organizations!inner(slug)")
            .eq("user_id", user.id)
            .eq("organizations.slug", orgSlug)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.rpc("is_platform_admin"),
    ]);
    setIsPlatformAdmin(platformAdminResult.data === true);

    if (orgResult.error) {
      toast.error("Error al cargar la organización. Verifica tu conexión.");
      setOrganization(null);
      setNotFound(false);
      setLoadError(true);
      setCurrentUserRole(null);
      setCurrentRole(null);
    } else if (orgResult.data) {
      setOrganization(orgResult.data as Organization);
      setNotFound(false);
      const member = memberResult.data as { role?: string; org_roles?: OrgRoleInfo | null } | null;
      setCurrentUserRole((member?.role as OrgRole) ?? null);
      setCurrentRole(member?.org_roles ?? null);
    } else {
      setOrganization(null);
      setNotFound(true);
      setCurrentUserRole(null);
      setCurrentRole(null);
    }
    setLoading(false);
  }, [orgSlug, user]);

  useEffect(() => {
    if (!user || !orgSlug) {
      setLoading(false);
      return;
    }
    load();
  }, [user, orgSlug, load]);


  const isSubscriptionActive = organization
    ? organization.subscription_status === "active" ||
      (organization.subscription_status === "trialing" &&
        new Date(organization.trial_ends_at) > new Date())
    : false;

  const isAdmin = currentRole ? currentRole.access_type === "admin" : currentUserRole === "admin";

  // Un plan_tier desconocido (fila vieja / valor inesperado) cae a "basic": el
  // fallo seguro es mostrar menos, nunca desbloquear de más.
  const planTier: PlanTier = isPlanTier(organization?.plan_tier) ? organization.plan_tier : "basic";
  const hasFeature = useCallback(
    (feature: Feature) => isPlatformAdmin || planHasFeature(planTier, feature),
    [isPlatformAdmin, planTier],
  );

  return (
    <OrganizationContext.Provider value={{ organization, loading, notFound, loadError, isSubscriptionActive, planTier, hasFeature, currentUserRole, currentRole, isAdmin, refetch: load }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
