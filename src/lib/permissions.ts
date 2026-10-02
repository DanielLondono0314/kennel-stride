// Catálogo de permisos por capacidad para roles personalizados.
// Espejo de public.org_permission_catalog() (migración 20260928000000_custom_roles):
// si se agrega una key aquí, hay que agregarla también allí.

export type OrgPermission =
  | "schedule"
  | "billing"
  | "cancel_invoice"
  | "clinical"
  | "report_cards"
  | "delete_records"
  | "view_reports"
  | "send_campaign"
  | "manage_facility"
  | "record_weight";

/** Tipo de acceso de un rol: qué app ve y si es administrador. */
export type AccessType = "admin" | "panel" | "worker";

/**
 * Secciones del panel que un rol puede ver. Espejo de
 * public.org_page_catalog() (migración 20261009000000_role_pages).
 */
export type OrgPage =
  | "dashboard" | "requests" | "calendar" | "tasks" | "facility" | "notices"
  | "customers" | "dogs" | "dog_panel" | "staff" | "report_cards" | "clinic"
  | "plans" | "invoices" | "contracts" | "reports" | "campaigns" | "routes";

export const PAGE_CATALOG: { key: OrgPage; label: string; path: string; group: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "dashboard", group: "Operaciones" },
  { key: "requests", label: "Solicitudes", path: "requests", group: "Operaciones" },
  { key: "calendar", label: "Calendario", path: "calendar", group: "Operaciones" },
  { key: "tasks", label: "Tareas", path: "tasks", group: "Operaciones" },
  { key: "facility", label: "Instalaciones", path: "facility", group: "Operaciones" },
  { key: "notices", label: "Avisos", path: "notices", group: "Operaciones" },
  { key: "routes", label: "Rutas", path: "routes", group: "Operaciones" },
  { key: "customers", label: "Clientes", path: "customers", group: "CRM" },
  { key: "dogs", label: "Perros", path: "dogs", group: "CRM" },
  { key: "dog_panel", label: "Panel de perros", path: "dog-panel", group: "CRM" },
  { key: "staff", label: "Personal", path: "staff", group: "CRM" },
  { key: "report_cards", label: "Report Cards", path: "report-cards", group: "CRM" },
  { key: "clinic", label: "Clínica", path: "clinic", group: "CRM" },
  { key: "plans", label: "Planes", path: "plans", group: "Finanzas" },
  { key: "invoices", label: "Facturación", path: "invoices", group: "Finanzas" },
  { key: "contracts", label: "Contratos", path: "contracts", group: "Finanzas" },
  { key: "reports", label: "Reportes", path: "reports", group: "Analytics" },
  { key: "campaigns", label: "Campañas", path: "campaigns", group: "Analytics" },
];

export interface OrgRoleInfo {
  id: string;
  name: string;
  access_type: AccessType;
  permissions: OrgPermission[];
  /** Secciones visibles; null = todas (como antes de existir este ajuste). */
  pages?: OrgPage[] | null;
  is_system: boolean;
  system_key: string | null;
}

export const PERMISSION_CATALOG: { key: OrgPermission; label: string; description: string }[] = [
  { key: "schedule", label: "Agendar reservas y tareas", description: "Crear y editar reservas, hacer check-in/check-out, asignar tareas y rutas." },
  { key: "billing", label: "Cobrar y facturar", description: "Crear facturas, registrar pagos y vender planes." },
  { key: "cancel_invoice", label: "Anular facturas", description: "Anular facturas ya emitidas." },
  { key: "clinical", label: "Registros clínicos", description: "Historial médico, vacunas, desparasitación y corregir pesos." },
  { key: "report_cards", label: "Reportes de perros", description: "Crear y enviar report cards a los dueños." },
  { key: "delete_records", label: "Borrar clientes y perros", description: "Eliminar clientes y perros de forma permanente." },
  { key: "view_reports", label: "Ver reportes del negocio", description: "Ingresos, ocupación y demás reportes." },
  { key: "send_campaign", label: "Enviar campañas", description: "Enviar campañas de email a clientes." },
  { key: "manage_facility", label: "Gestionar perreras", description: "Crear y editar zonas y perreras." },
  { key: "record_weight", label: "Registrar peso", description: "Registrar el peso de los perros." },
];

export const ACCESS_TYPE_OPTIONS: { value: AccessType; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acceso total, incluye personal, roles y configuración." },
  { value: "panel", label: "Panel", description: "Panel de administración limitado a los permisos marcados." },
  { value: "worker", label: "App de trabajador", description: "Solo la app de trabajador (Mi día, Mi ruta, Horario)." },
];

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  admin: "Administrador",
  panel: "Panel",
  worker: "App de trabajador",
};

export function roleHasPermission(role: Pick<OrgRoleInfo, "access_type" | "permissions"> | null, perm: OrgPermission): boolean {
  if (!role) return false;
  return role.access_type === "admin" || role.permissions.includes(perm);
}

/** El rol ve esta sección del panel (admin y roles sin lista: todas). */
export function roleCanSeePage(role: Pick<OrgRoleInfo, "access_type" | "pages"> | null, page: OrgPage): boolean {
  if (!role) return true; // miembros sin rol asignado: comportamiento de siempre
  if (role.access_type === "admin" || !role.pages) return true;
  return role.pages.includes(page);
}

/** Primera sección visible (ruta relativa a la org), para la página de inicio. */
export function firstAllowedPath(role: Pick<OrgRoleInfo, "access_type" | "pages"> | null): string {
  const page = PAGE_CATALOG.find((p) => roleCanSeePage(role, p.key));
  return page?.path ?? "dashboard";
}
