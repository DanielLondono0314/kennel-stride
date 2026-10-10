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
  | "plans" | "invoices" | "contracts" | "reports" | "campaigns" | "routes"
  | "my_day" | "my_schedule" | "my_route";

export const PAGE_CATALOG: { key: OrgPage; label: string; path: string; group: string }[] = [
  { key: "my_day", label: "Mi día", path: "my-day", group: "Mi trabajo" },
  { key: "my_schedule", label: "Mi horario", path: "my-schedule", group: "Mi trabajo" },
  { key: "my_route", label: "Mi ruta", path: "my-route", group: "Mi trabajo" },
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

// Todos los roles usan el mismo panel. "Personal operativo" (antes "App de
// trabajador") se diferencia de "Oficina" en que empieza en Mi día y aparece
// como encargado asignable en tareas, reservas y rondas de bienestar.
export const ACCESS_TYPE_OPTIONS: { value: AccessType; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acceso total, incluye personal, roles y configuración." },
  { value: "panel", label: "Oficina", description: "Panel limitado a las secciones y permisos marcados (recepción, gerencia, veterinaria…)." },
  { value: "worker", label: "Personal operativo", description: "Panel limitado a las secciones y permisos marcados; empieza en Mi día y se le asignan tareas, reservas y rondas." },
];

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  admin: "Administrador",
  panel: "Oficina",
  worker: "Personal operativo",
};

/** Secciones de un rol operativo sin lista (espejo de org_worker_default_pages). */
export const WORKER_DEFAULT_PAGES: OrgPage[] = ["clinic", "dogs", "facility", "my_day", "my_route", "my_schedule", "notices"];

export function roleHasPermission(role: Pick<OrgRoleInfo, "access_type" | "permissions"> | null, perm: OrgPermission): boolean {
  if (!role) return false;
  return role.access_type === "admin" || role.permissions.includes(perm);
}

/** Secciones efectivas del rol (null = todas). */
export function rolePages(role: Pick<OrgRoleInfo, "access_type" | "pages"> | null): OrgPage[] | null {
  if (!role || role.access_type === "admin") return null;
  if (role.pages) return role.pages;
  return role.access_type === "worker" ? WORKER_DEFAULT_PAGES : null;
}

/** El rol ve esta sección del panel (admin y roles de oficina sin lista: todas). */
export function roleCanSeePage(role: Pick<OrgRoleInfo, "access_type" | "pages"> | null, page: OrgPage): boolean {
  const pages = rolePages(role);
  return pages === null || pages.includes(page);
}

/**
 * Página de inicio (ruta relativa a la org): el personal operativo empieza en
 * Mi día; los demás en la primera sección de gestión que puedan ver.
 */
export function firstAllowedPath(role: Pick<OrgRoleInfo, "access_type" | "pages"> | null): string {
  if (role?.access_type === "worker" && roleCanSeePage(role, "my_day")) return "my-day";
  const page = PAGE_CATALOG.find((p) => !p.key.startsWith("my_") && roleCanSeePage(role, p.key))
    ?? PAGE_CATALOG.find((p) => roleCanSeePage(role, p.key));
  return page?.path ?? "dashboard";
}
