import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

/** Allows only role=worker. Other roles → admin dashboard. */
export function WorkerRoute() {
  const { loading, currentUserRole, organization } = useOrganization();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (currentUserRole && currentUserRole !== "worker") {
    return <Navigate to={`/${organization?.slug}/dashboard`} replace />;
  }
  return <Outlet />;
}

/** Blocks role=worker from admin routes → /worker. */
export function AdminOnlyRoute() {
  const { loading, currentUserRole, organization } = useOrganization();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (currentUserRole === "worker") {
    return <Navigate to={`/${organization?.slug}/worker`} replace />;
  }
  return <Outlet />;
}
