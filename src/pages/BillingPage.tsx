import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dog, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, type PlanTier } from "@/lib/plans";
import { SELECT_ORG_PATH } from "@/lib/orgNavigation";
import type { SedeQuota } from "@/hooks/queries/useMyOrganizations";

// [E4] Base checkout URLs come from env vars (one per plan, see .env.example).
// These are the bare LemonSqueezy checkout links WITHOUT any custom data; we
// append the org id at runtime. A plan without URL is simply not offered.
const PLAN_CHECKOUT_BASE: Record<PlanTier, string | undefined> = {
  premium: import.meta.env.VITE_LS_CHECKOUT_URL_PREMIUM as string | undefined,
  pro: import.meta.env.VITE_LS_CHECKOUT_URL_PRO as string | undefined,
  basic: import.meta.env.VITE_LS_CHECKOUT_URL_BASIC as string | undefined,
};
const CHECKOUT_ORDER: PlanTier[] = ["premium", "pro", "basic"];

/**
 * Append LemonSqueezy custom checkout data so the webhook can link the resulting
 * subscription back to this organization, e.g.
 *   ?checkout[custom][org_id]=<orgId>&checkout[email]=<email>
 * Returns null if there is no base URL configured for the plan.
 */
function buildCheckoutUrl(
  base: string | undefined,
  orgId: string | null,
  email: string | null,
): string | null {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (orgId) url.searchParams.set("checkout[custom][org_id]", orgId);
    if (email) url.searchParams.set("checkout[email]", email);
    return url.toString();
  } catch {
    // Misconfigured (not an absolute URL) — treat as not configured.
    return null;
  }
}

interface BillingOrg {
  id: string;
  slug: string;
  name: string;
  parent_org_id: string | null;
  subscription_status: string;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedSlug = searchParams.get("org");
  const [org, setOrg] = useState<BillingOrg | null>(null);
  const [sede, setSede] = useState<SedeQuota | null>(null);
  const [resolving, setResolving] = useState(true);

  // [E4] BillingPage renders outside the org-scoped route tree (OrgGuard
  // redirects here with ?org=<slug> when the subscription is inactive), so
  // there is no OrganizationContext. With several centros the checkout must
  // carry the org that sent us here, not just the user's first one.
  useEffect(() => {
    let cancelled = false;
    async function resolveOrg() {
      if (!user) {
        if (!cancelled) setResolving(false);
        return;
      }
      const { data } = await supabase
        .from("organization_members")
        .select("created_at, organizations!inner(id, slug, name, parent_org_id, subscription_status)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const orgs = ((data ?? []) as unknown as { organizations: BillingOrg }[]).map((m) => m.organizations);
      const found = orgs.find((o) => o.slug === requestedSlug) ?? orgs[0] ?? null;

      // Una sede no se paga sola: depende de la suscripción de su principal.
      let quota: SedeQuota | null = null;
      if (found?.parent_org_id) {
        const { data: q } = await supabase.rpc("get_sede_quota", { p_org_id: found.id });
        quota = (q as unknown as SedeQuota) ?? null;
      }

      if (cancelled) return;
      setOrg(found);
      setSede(quota);
      setResolving(false);
    }
    resolveOrg();
    return () => {
      cancelled = true;
    };
  }, [user, requestedSlug]);

  const email = user?.email ?? null;
  const checkoutLinks = useMemo(
    () =>
      CHECKOUT_ORDER.map((tier) => ({ tier, url: buildCheckoutUrl(PLAN_CHECKOUT_BASE[tier], org?.id ?? null, email) }))
        .filter((l): l is { tier: PlanTier; url: string } => l.url !== null),
    [org?.id, email],
  );

  const isSede = !!org?.parent_org_id;
  const title = isSede ? "Sede sin plan activo" : "Suscripción inactiva";
  const description = !isSede
    ? "Tu período de prueba ha terminado o la suscripción fue cancelada. Activa tu plan para continuar usando Tails Up."
    : org?.subscription_status === "suspended"
      ? `${sede?.principal_name ?? "La sede principal"} ya no tiene el plan Premium, que es el que incluye las sedes. Los datos de ${org.name} están intactos y vuelve a funcionar en cuanto la sede principal reactive Premium.`
      : `${org?.name} usa la suscripción de ${sede?.principal_name ?? "su sede principal"}, que está inactiva. Vuelve a funcionar en cuanto se reactive el pago.`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Dog className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
        </div>
        <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {org && !resolving && <p className="mt-1 text-sm font-medium">{org.name}</p>}
          <p className="text-muted-foreground mt-2">{resolving ? null : description}</p>
        </div>

        {resolving ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isSede ? (
          <div className="space-y-3">
            {sede?.is_owner && (
              <Button className="w-full" asChild>
                <Link to={`/billing?org=${encodeURIComponent(sede.principal_slug)}`}>
                  Ir a la facturación de {sede.principal_name}
                </Link>
              </Button>
            )}
            <Button variant="ghost" className="w-full" asChild>
              <Link to={SELECT_ORG_PATH}>Ver mis centros</Link>
            </Button>
          </div>
        ) : checkoutLinks.length > 0 ? (
          <div className="space-y-3">
            {checkoutLinks.map(({ tier, url }, i) => (
              <Button key={tier} variant={i === 0 ? "default" : "outline"} className="w-full" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                  Activar {PLANS[tier].name} — ${PLANS[tier].monthlyUsd}/mes
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ))}
            {checkoutLinks.some((l) => l.tier === "premium") && (
              <p className="text-xs text-muted-foreground">
                Premium incluye multi-sede: hasta {PLANS.premium.maxLocations} sedes con una sola suscripción.
              </p>
            )}
            <Button variant="ghost" className="w-full" asChild>
              <Link to={SELECT_ORG_PATH}>Ver mis centros</Link>
            </Button>
          </div>
        ) : (
          // [E4] No checkout URL configured — surface a clear "not configured"
          // state instead of a dead placeholder link.
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
              La facturación aún no está configurada. Contacta al soporte de
              Tails Up para activar tu suscripción.
            </div>
            <Button variant="ghost" className="w-full" asChild>
              <Link to={user ? SELECT_ORG_PATH : "/login"}>Volver</Link>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Pagos procesados de forma segura por{" "}
          <a
            href="https://lemonsqueezy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            LemonSqueezy
          </a>
          . Cancela cuando quieras.
        </p>
      </div>
    </div>
  );
}
