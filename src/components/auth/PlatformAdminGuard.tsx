import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PlatformAdminProvider, usePlatformAdmin } from "@/contexts/PlatformAdminContext";
import NotFound from "@/pages/NotFound";

function PlatformAdminGuardInner() {
  const { loading, isPlatformAdmin } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Nunca revelar que la ruta existe a quien no es platform admin: se
  // renderiza el 404 normal en vez de redirigir a un login/permiso.
  if (!isPlatformAdmin) return <NotFound />;

  return <Outlet />;
}

export function PlatformAdminGuard() {
  const { session, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <PlatformAdminProvider>
      <PlatformAdminGuardInner />
    </PlatformAdminProvider>
  );
}
