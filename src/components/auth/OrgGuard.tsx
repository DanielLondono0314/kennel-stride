import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";

function OrgGuardInner() {
  const { session, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading, notFound, isSubscriptionActive } = useOrganization();

  if (authLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
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
