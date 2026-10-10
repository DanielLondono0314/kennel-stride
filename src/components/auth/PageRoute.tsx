import { Navigate, Outlet, useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePermission } from "@/hooks/usePermission";
import { firstAllowedPath, roleCanSeePage, type OrgPage, type OrgPermission } from "@/lib/permissions";

/**
 * Ruta de una sección del panel: si el rol no la ve, lleva a la primera que
 * sí ve. Con `perm`, además exige ese permiso (p. ej. Facturación pide "Ver
 * facturas"); sin él se muestra un aviso en vez de una página vacía.
 */
export function PageRoute({ page, perm }: { page: OrgPage; perm?: OrgPermission }) {
  const { currentRole, loading } = useOrganization();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const hasPerm = usePermission(perm ?? "manage_settings");
  if (loading) return null;
  if (!roleCanSeePage(currentRole, page)) {
    return <Navigate to={`/${orgSlug}/${firstAllowedPath(currentRole)}`} replace />;
  }
  if (perm && !hasPerm) {
    return <EmptyState icon={Lock} title="Sin acceso" description="Tu rol no tiene el permiso para ver esta sección. Pídeselo a un administrador." />;
  }
  return <Outlet />;
}
