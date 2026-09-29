import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  /** Catálogo de servicios (ver src/lib/serviceCatalog.ts): JSONB con campos opcionales. */
  service_types: Array<{ value: string; label: string; category?: string } & Record<string, unknown>>;
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
  // Solo el id: al volver a la pestaña Supabase renueva el token y entrega un
  // objeto `user` nuevo (mismo usuario). Depender del objeto recargaba la org
  // en cada renovación.
  const userId = user?.id ?? null;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrgRole | null>(null);
  const [currentRole, setCurrentRole] = useState<OrgRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Los platform admins (equipo KennelStride) ven todas las features en cualquier org.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Qué (usuario, org) ya se cargó. Las recargas de lo mismo son silenciosas:
  // `loading` hace que OrgGuard cambie TODA la app por un spinner, lo que
  // desmonta la página y borra lo que el usuario llevaba (p. ej. el asistente
  // de contratos volvía al paso 2 tras un alt-tab).
  const loadedKeyRef = useRef<string | null>(null);
  // (usuario, org) vigente, para descartar respuestas que llegan tarde.
  const latestKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!orgSlug || !userId) return;
    const key = `${userId}:${orgSlug}`;
    const background = loadedKeyRef.current === key;
    if (!background) {
      setLoading(true);
      setNotFound(false);
      setLoadError(false);
    }

    // Load org + current user's role in one round-trip
    const [orgResult, memberResult, platformAdminResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, slug, name, logo_url, subscription_status, plan_tier, trial_ends_at, opening_time, closing_time, timezone, address, city, phone, email, service_types, route_notifications_enabled, route_notification_channel")
        .eq("slug", orgSlug)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("role, org_roles(id, name, access_type, permissions, is_system, system_key), organizations!inner(slug)")
        .eq("user_id", userId)
        .eq("organizations.slug", orgSlug)
        .maybeSingle(),
      supabase.rpc("is_platform_admin"),
    ]);
    // Si mientras tanto cambió de org o de usuario, esta respuesta ya no aplica.
    if (key !== latestKeyRef.current) return;

    if (orgResult.error && background) {
      // Un fallo de red en una recarga silenciosa no debe sacar al usuario de
      // lo que está haciendo: se conservan los datos que ya había.
      return;
    }

    setIsPlatformAdmin(platformAdminResult.data === true);

    if (orgResult.error) {
      toast.error("Error al cargar la organización. Verifica tu conexión.");
      setOrganization(null);
      setNotFound(false);
      setLoadError(true);
      setCurrentUserRole(null);
      setCurrentRole(null);
    } else if (orgResult.data) {
      const next = orgResult.data as Organization;
      // Mismo contenido → misma referencia, para no re-renderizar la app.
      setOrganization((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setNotFound(false);
      loadedKeyRef.current = key;
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
  }, [orgSlug, userId]);

  useEffect(() => {
    latestKeyRef.current = userId && orgSlug ? `${userId}:${orgSlug}` : null;
    if (!userId || !orgSlug) {
      setLoading(false);
      return;
    }
    load();
  }, [userId, orgSlug, load]);


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
