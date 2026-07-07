import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dog, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// [E4] Base checkout URLs come from env vars (one per plan). These are the bare
// LemonSqueezy checkout links WITHOUT any custom data; we append the org id at
// runtime. When a plan's URL is not configured, billing is shown as "no
// configurado" instead of rendering a dead "#" placeholder link.
//
// Env vars (owned/documented by Stream G in .env.example):
//   VITE_LS_CHECKOUT_URL_STARTER
//   VITE_LS_CHECKOUT_URL_GROWTH
const PLAN_CHECKOUT_BASE = {
  starter: import.meta.env.VITE_LS_CHECKOUT_URL_STARTER as string | undefined,
  growth: import.meta.env.VITE_LS_CHECKOUT_URL_GROWTH as string | undefined,
};

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

export default function BillingPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // [E4] BillingPage renders outside the org-scoped route tree (it is reached via
  // a redirect from OrgGuard when the subscription is inactive), so there is no
  // OrganizationContext here. Resolve the user's organization directly so the
  // checkout can carry a real org_id.
  useEffect(() => {
    let cancelled = false;
    async function resolveOrg() {
      if (!user) {
        if (!cancelled) {
          setResolving(false);
        }
        return;
      }
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id, organizations!inner(id, slug, created_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const org = (data as { organizations?: { id?: string; slug?: string } } | null)?.organizations;
      setOrgId(org?.id ?? null);
      setSlug(org?.slug ?? null);
      setResolving(false);
    }
    resolveOrg();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const email = user?.email ?? null;

  const growthUrl = useMemo(
    () => buildCheckoutUrl(PLAN_CHECKOUT_BASE.growth, orgId, email),
    [orgId, email],
  );
  const starterUrl = useMemo(
    () => buildCheckoutUrl(PLAN_CHECKOUT_BASE.starter, orgId, email),
    [orgId, email],
  );

  const billingConfigured = Boolean(growthUrl || starterUrl);
  const backTo = slug ? `/${slug}/dashboard` : "/login";

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
          <h2 className="text-2xl font-bold">Suscripción inactiva</h2>
          <p className="text-muted-foreground mt-2">
            Tu período de prueba ha terminado o la suscripción fue cancelada.
            Activa tu plan para continuar usando KennelOps.
          </p>
        </div>

        {resolving ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : billingConfigured ? (
          <div className="space-y-3">
            {growthUrl && (
              <Button className="w-full" asChild>
                <a
                  href={growthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Activar plan Growth — $179/mes
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {starterUrl && (
              <Button variant="outline" className="w-full" asChild>
                <a
                  href={starterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Activar plan Starter — $79/mes
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="ghost" className="w-full" asChild>
              <Link to={backTo}>Volver al inicio</Link>
            </Button>
          </div>
        ) : (
          // [E4] No checkout URL configured — surface a clear "not configured"
          // state instead of a dead placeholder link.
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
              La facturación aún no está configurada. Contacta al soporte de
              KennelOps para activar tu suscripción.
            </div>
            <Button variant="ghost" className="w-full" asChild>
              <Link to={backTo}>Volver al inicio</Link>
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
