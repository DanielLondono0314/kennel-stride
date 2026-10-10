import { firstAllowedPath } from "@/lib/permissions";
import { Navigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

/** Inicio según el rol: el personal operativo empieza en Mi día; los demás en su primera sección. */
export function RoleHome() {
  const { loading, currentRole } = useOrganization();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  return <Navigate to={firstAllowedPath(currentRole)} replace />;
}
