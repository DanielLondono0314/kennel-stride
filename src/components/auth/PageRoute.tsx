import { Navigate, Outlet, useParams } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { firstAllowedPath, roleCanSeePage, type OrgPage } from "@/lib/permissions";

/**
 * Sección del panel limitada por el rol (Configuración → Roles → Secciones).
 * Si el rol no la ve, lleva a la primera sección que sí puede ver.
 */
export function PageRoute({ page }: { page: OrgPage }) {
  const { currentRole, loading } = useOrganization();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  if (loading) return null;
  if (roleCanSeePage(currentRole, page)) return <Outlet />;
  return <Navigate to={`/${orgSlug}/${firstAllowedPath(currentRole)}`} replace />;
}
