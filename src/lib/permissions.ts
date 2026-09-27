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

export interface OrgRoleInfo {
  id: string;
  name: string;
  access_type: AccessType;
  permissions: OrgPermission[];
  is_system: boolean;
  system_key: string | null;
}

export const PERMISSION_CATALOG: { key: OrgPermission; label: string; description: string }[] = [
  { key: "schedule", label: "Agendar reservas y tareas", description: "Crear y editar reservas, hacer check-in/check-out, asignar tareas y rutas." },
  { key: "billing", label: "Cobrar y facturar", description: "Crear facturas, registrar pagos y vender paquetes." },
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
