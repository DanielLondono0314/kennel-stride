// Catálogo de permisos detallados por módulo para roles personalizados.
// Espejo de public.org_permission_catalog() y org_permission_implied()
// (migración 20261017000000_granular_permissions): si se agrega una key aquí,
// hay que agregarla también allí.

export const PERMISSION_GROUPS = [
  {
    key: "reservations",
    label: "Reservas y estadías",
    permissions: [
      { key: "reservations.view_all", label: "Ver todas las reservas", description: "Sin esto, solo ve las reservas que tiene asignadas." },
      { key: "reservations.create", label: "Crear reservas", description: "Agendar reservas nuevas." },
      { key: "reservations.edit", label: "Editar reservas", description: "Cambiar fechas, servicio, precio y encargado." },
      { key: "reservations.approve", label: "Aprobar solicitudes", description: "Aceptar o rechazar las solicitudes de reserva." },
      { key: "reservations.cancel", label: "Cancelar reservas", description: "Cancelar o marcar \"no se presentó\"." },
      { key: "reservations.delete", label: "Eliminar reservas", description: "Borrar reservas de forma permanente." },
      { key: "stays.checkin", label: "Hacer check-in", description: "Recibir al perro y asignarle perrera." },
      { key: "stays.checkout", label: "Hacer check-out", description: "Entregar al perro y liberar su perrera. Cobrar requiere \"Crear facturas y cobrar\"." },
    ],
  },
  {
    key: "facility",
    label: "Instalaciones",
    permissions: [
      { key: "kennels.move", label: "Mover perros entre perreras", description: "Cambiar a un perro de perrera sin hacer check-in ni check-out." },
      { key: "kennels.assign", label: "Operar perreras", description: "Asignar y liberar perreras a mano, marcar mantenimiento y notas." },
      { key: "facility.manage", label: "Configurar instalaciones", description: "Crear, renombrar, reordenar y eliminar zonas y perreras." },
    ],
  },
  {
    key: "tasks",
    label: "Tareas y rutas",
    permissions: [
      { key: "tasks.view_all", label: "Ver todas las tareas", description: "Sin esto, solo ve y completa las suyas." },
      { key: "tasks.create", label: "Crear y asignar tareas", description: "Crear tareas y elegir a quién se asignan." },
      { key: "tasks.edit", label: "Editar tareas de otros", description: "Cambiar, reasignar o completar tareas de cualquier persona." },
      { key: "tasks.delete", label: "Eliminar tareas", description: "Borrar tareas." },
      { key: "routes.manage", label: "Gestionar rutas", description: "Armar rutas de recogida y entrega y avisar a los clientes." },
    ],
  },
  {
    key: "customers",
    label: "Clientes",
    permissions: [
      { key: "customers.view_contact", label: "Ver contacto de clientes", description: "Teléfono, correo y dirección." },
      { key: "customers.create", label: "Crear clientes", description: "Registrar clientes nuevos." },
      { key: "customers.edit", label: "Editar clientes", description: "Cambiar los datos de un cliente." },
      { key: "customers.delete", label: "Eliminar clientes", description: "Borrar clientes de forma permanente." },
    ],
  },
  {
    key: "dogs",
    label: "Perros",
    permissions: [
      { key: "dogs.create", label: "Crear perros", description: "Registrar perros nuevos." },
      { key: "dogs.edit", label: "Editar ficha del perro", description: "Datos, alergias, medicación y temperamento." },
      { key: "dogs.delete", label: "Eliminar perros", description: "Borrar perros de forma permanente." },
    ],
  },
  {
    key: "health",
    label: "Salud y bienestar",
    permissions: [
      { key: "clinical.view", label: "Ver historia clínica", description: "Historial médico, vacunas y desparasitaciones." },
      { key: "clinical.edit", label: "Registrar historia clínica", description: "Vacunas, desparasitaciones, historial y condiciones médicas." },
      { key: "clinical.import", label: "Importar historias clínicas", description: "Cargar registros clínicos desde un archivo." },
      { key: "weight.record", label: "Registrar peso", description: "Anotar el peso de los perros." },
      { key: "weight.edit", label: "Corregir pesos", description: "Editar o borrar pesos ya registrados." },
      { key: "welfare.configure", label: "Configurar rondas de bienestar", description: "Elegir qué se revisa en cada ronda." },
      { key: "report_cards.write", label: "Report cards", description: "Crear y enviar report cards a los dueños." },
    ],
  },
  {
    key: "finance",
    label: "Planes, cobros y facturas",
    permissions: [
      { key: "prices.view", label: "Ver precios y montos", description: "Precios de servicios, reservas y planes." },
      { key: "plans.sell", label: "Vender planes", description: "Asignar, editar y terminar planes de perros." },
      { key: "plans.use", label: "Descontar de planes", description: "Registrar el uso de un plan (también en el check-out)." },
      { key: "packages.manage", label: "Gestionar paquetes de créditos", description: "Vender y ajustar paquetes de créditos." },
      { key: "invoices.view", label: "Ver facturas", description: "Facturas y saldos de los clientes." },
      { key: "invoices.create", label: "Crear facturas y cobrar", description: "Emitir facturas y cobrar en el check-out." },
      { key: "invoices.payment", label: "Registrar pagos", description: "Marcar facturas como pagadas." },
      { key: "invoices.cancel", label: "Anular facturas", description: "Anular facturas ya emitidas." },
      { key: "contracts.view", label: "Ver contratos", description: "Contratos firmados por los clientes." },
      { key: "contracts.create", label: "Crear contratos", description: "Generar contratos y enviarlos a firmar." },
    ],
  },
  {
    key: "business",
    label: "Negocio",
    permissions: [
      { key: "reports.view", label: "Ver reportes", description: "Ocupación, servicios y demás reportes." },
      { key: "finance.view_income", label: "Ver ingresos", description: "Totales de ingresos en el dashboard y los reportes." },
      { key: "campaigns.send", label: "Enviar campañas", description: "Crear y enviar campañas de email a clientes." },
    ],
  },
] as const;

export type OrgPermission = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const PERMISSION_CATALOG: { key: OrgPermission; label: string; description: string; group: string }[] =
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => ({ ...p, group: g.label })));

/**
 * Permisos que necesitan otro para tener sentido (no se puede editar una
 * reserva que no se ve). Espejo de public.org_permission_implied().
 */
export const PERMISSION_IMPLIES: Partial<Record<OrgPermission, OrgPermission[]>> = {
  "reservations.create": ["reservations.view_all", "prices.view"],
  "reservations.edit": ["reservations.view_all", "prices.view"],
  "reservations.approve": ["reservations.view_all"],
  "reservations.cancel": ["reservations.view_all"],
  "reservations.delete": ["reservations.view_all"],
  "stays.checkin": ["reservations.view_all"],
  "stays.checkout": ["reservations.view_all"],
  "tasks.create": ["tasks.view_all"],
  "tasks.edit": ["tasks.view_all"],
  "tasks.delete": ["tasks.view_all"],
  "customers.create": ["customers.view_contact"],
  "customers.edit": ["customers.view_contact"],
  "clinical.edit": ["clinical.view"],
  "clinical.import": ["clinical.view"],
  "plans.sell": ["prices.view"],
  "packages.manage": ["prices.view"],
  "invoices.create": ["invoices.view"],
  "invoices.payment": ["invoices.view"],
  "invoices.cancel": ["invoices.view"],
  "invoices.view": ["prices.view"],
  "finance.view_income": ["prices.view"],
  "contracts.create": ["contracts.view"],
};

/** Los permisos con todos sus implícitos (cierre transitivo), en orden de catálogo. */
export function withImpliedPermissions(perms: Iterable<OrgPermission>): OrgPermission[] {
  const out = new Set<OrgPermission>();
  const visit = (p: OrgPermission) => {
    if (out.has(p)) return;
    out.add(p);
    PERMISSION_IMPLIES[p]?.forEach(visit);
  };
  for (const p of perms) visit(p);
  return PERMISSION_CATALOG.map((p) => p.key).filter((k) => out.has(k));
}

/** Qué permisos marcados obligan a tener este (para explicarlo en el editor). */
export function permissionRequiredBy(perm: OrgPermission, selected: Iterable<OrgPermission>): OrgPermission[] {
  const sel = [...selected];
  return sel.filter((s) => s !== perm && withImpliedPermissions([s]).includes(perm));
}

/** Qué permiso exige pasar una reserva de un estado a otro. Espejo de public.reservation_status_permission(). */
export function reservationStatusPermission(from: string, to: string): OrgPermission {
  if (from === "requested" && ["scheduled", "cancelled", "rejected"].includes(to)) return "reservations.approve";
  if (to === "rejected") return "reservations.approve";
  if (to === "cancelled" || to === "no_show") return "reservations.cancel";
  if (to === "checked_in" || to === "in_progress") return "stays.checkin";
  if (to === "ready" || to === "completed") return "stays.checkout";
  return "reservations.edit";
}

/** Permisos que da una especialidad sin importar el rol. Espejo de org_specialty_permissions(). */
export const SPECIALTY_PERMISSIONS: Record<string, OrgPermission[]> = {
  vet: ["clinical.view", "clinical.edit", "clinical.import", "weight.edit", "welfare.configure"],
  trainer: ["report_cards.write"],
};

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

export function roleHasPermission(
  role: Pick<OrgRoleInfo, "access_type" | "permissions"> | null,
  perm: OrgPermission,
  specialty?: string | null,
): boolean {
  if (!role) return false;
  return role.access_type === "admin"
    || role.permissions.includes(perm)
    || (!!specialty && !!SPECIALTY_PERMISSIONS[specialty]?.includes(perm));
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
