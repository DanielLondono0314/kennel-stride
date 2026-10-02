import { useOrganization } from "@/contexts/OrganizationContext";
import { type OrgPage, type OrgPermission, roleCanSeePage, roleHasPermission } from "@/lib/permissions";

/**
 * Permisos del rol del usuario en la org actual (roles personalizados por org).
 * - Una key del catálogo → la tiene el rol (o el rol es de tipo admin).
 * - "manage_staff" / "manage_settings" → exclusivos del tipo de acceso admin.
 * Espejo de la RLS (get_org_ids_with_permission / get_admin_org_ids).
 */
export type Permission = OrgPermission | "manage_staff" | "manage_settings";

export function usePermission(action: Permission): boolean {
  const { currentRole } = useOrganization();
  if (!currentRole) return false;
  if (action === "manage_staff" || action === "manage_settings") {
    return currentRole.access_type === "admin";
  }
  return roleHasPermission(currentRole, action);
}

/** El rol del usuario puede ver esta sección del panel (menú y rutas). */
export function useCanSeePage(page: OrgPage): boolean {
  const { currentRole } = useOrganization();
  return roleCanSeePage(currentRole, page);
}
