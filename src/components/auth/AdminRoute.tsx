import { Navigate, Outlet, useParams } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";

/** Configuración del centro: solo acceso Administrador; el resto va a Mi perfil. */
export function AdminRoute() {
  const { isAdmin, loading } = useOrganization();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  if (loading) return null;
  return isAdmin ? <Outlet /> : <Navigate to={`/${orgSlug}/profile`} replace />;
}
