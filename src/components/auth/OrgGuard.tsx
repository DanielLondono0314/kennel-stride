import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

function OrgGuardInner() {
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading, notFound, loadError, isSubscriptionActive, refetch } = useOrganization();

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

  // Org slug exists in URL but does not exist in DB — send to onboarding, not login
  if (notFound) return <Navigate to="/onboarding" replace />;
  if (!organization) return <Navigate to="/login" replace />;
  if (!isSubscriptionActive) return <Navigate to="/billing" replace />;

  return <Outlet />;
}

export function OrgGuard() {
  return (
    <OrganizationProvider>
      <OrgGuardInner />
    </OrganizationProvider>
  );
}
