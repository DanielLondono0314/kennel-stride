import { Navigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

export function RoleHome() {
  const { loading, currentUserRole } = useOrganization();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  return <Navigate to={currentUserRole === "worker" ? "worker" : "dashboard"} replace />;
}
