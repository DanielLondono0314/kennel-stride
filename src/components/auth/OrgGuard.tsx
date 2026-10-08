import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { Building2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

function OrgGuardInner() {
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading, notFound, loadError, isSubscriptionActive, refetch } = useOrganization();

  // Pestaña del navegador: "TailsUp | {centro}". Al salir del centro vuelve al título base de index.html.
  useEffect(() => {
    if (!organization?.name) return;
    document.title = `TailsUp | ${organization.name}`;
    return () => { document.title = "TailsUp"; };
  }, [organization?.name]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Preserva el deep-link: en el hard-load hay un instante con session=null
  // y sin `from` el LoginPage redirige a su destino por defecto (dashboard),
  // perdiendo la URL original (p. ej. /:org/customers).
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // DB error — show error screen with retry, never redirect to login (that creates a loop)
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Error al cargar la organización.</p>
        <Button variant="outline" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  // El centro de la URL no existe o el usuario no tiene acceso.
  if (notFound) return <OrgNotFound />;

  // Sesión OK pero la org aún es null sin notFound/loadError: el fetch de la
  // org todavía no corrió para esta sesión (OrganizationContext hace
  // setLoading(false) cuando user aún no estaba listo y re-carga al llegar).
  // Antes esto rebotaba a /login SIN state y se perdía el deep-link
  // (login → primer org → dashboard). Es un estado de carga, no de rechazo.
  if (!organization) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSubscriptionActive) return <Navigate to="/billing" replace />;

  return <Outlet />;
}

/**
 * Centro inexistente o sin acceso. Antes siempre mandaba a /onboarding, y un
 * usuario que escribía mal el enlace podía crear un segundo centro por error
 * (QA E-05). Ahora solo va a onboarding quien no tiene ningún centro.
 */
function OrgNotFound() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [ownSlug, setOwnSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_my_first_org_slug").then(({ data, error }) => {
      // Si falla la consulta no se asume "sin centro": nunca mandar a crear uno por un error de red.
      if (!cancelled) setOwnSlug(error ? "" : (data as string | null) || null);
    });
    return () => { cancelled = true; };
  }, []);

  if (ownSlug === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (ownSlug === null) return <Navigate to="/onboarding" replace />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Building2 className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Centro no encontrado o sin acceso</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No existe un centro con la dirección <span className="font-medium text-foreground">/{orgSlug}</span>, o tu cuenta no tiene acceso a él.
      </p>
      <Button asChild>
        <Link to={ownSlug ? `/${ownSlug}/dashboard` : "/"} replace>{ownSlug ? "Ir a mi centro" : "Volver al inicio"}</Link>
      </Button>
    </main>
  );
}

export function OrgGuard() {
  return (
    <OrganizationProvider>
      <OrgGuardInner />
    </OrganizationProvider>
  );
}
