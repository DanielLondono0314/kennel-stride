/** Un centro al que pertenece el usuario, con su rol en ese centro. */
export interface MyOrganization {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Sede principal de la que depende (null = centro independiente o principal). */
  parentOrgId: string | null;
  /** El usuario es el dueño del centro (quien lo creó / quien paga). */
  isOwner: boolean;
  /** Nombre del rol (personalizado o de sistema) en ese centro. */
  roleName: string;
  isWorker: boolean;
}

export interface MembershipRow {
  role: string | null;
  org_roles: { name: string | null; access_type: string | null } | null;
  organizations: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    parent_org_id: string | null;
    owner_id: string | null;
  } | null;
}

const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  front_desk: "Recepción",
  worker: "Trabajador",
};

export function toMyOrganization(row: MembershipRow, userId: string): MyOrganization | null {
  if (!row.organizations) return null;
  const legacy = row.role ?? "";
  return {
    id: row.organizations.id,
    slug: row.organizations.slug,
    name: row.organizations.name,
    logoUrl: row.organizations.logo_url,
    parentOrgId: row.organizations.parent_org_id,
    isOwner: row.organizations.owner_id === userId,
    roleName: row.org_roles?.name || LEGACY_ROLE_LABELS[legacy] || "Miembro",
    isWorker: row.org_roles ? row.org_roles.access_type === "worker" : legacy === "worker",
  };
}

/**
 * Orden para el selector de centros: cada principal seguida de sus sedes
 * (alfabético dentro de cada grupo). Una sede cuya principal no es visible
 * para el usuario (p. ej. un trabajador de una sola sede) queda suelta.
 */
export function orderByLocation(orgs: MyOrganization[]): MyOrganization[] {
  const byName = (a: MyOrganization, b: MyOrganization) => a.name.localeCompare(b.name, "es");
  const ids = new Set(orgs.map((o) => o.id));
  const roots = orgs.filter((o) => !o.parentOrgId || !ids.has(o.parentOrgId)).sort(byName);
  return roots.flatMap((root) => [
    root,
    ...orgs.filter((o) => o.parentOrgId === root.id).sort(byName),
  ]);
}

/** Etiqueta del centro en el selector: "Sede principal", "Sede" o nada. */
export function locationLabel(org: MyOrganization, orgs: MyOrganization[]): string | null {
  if (org.parentOrgId) return "Sede";
  if (orgs.some((o) => o.parentOrgId === org.id)) return "Sede principal";
  return null;
}

/** Principal (o centro independiente) del que el usuario es dueño: desde ahí se crean sedes. */
export function ownedPrincipal(orgs: MyOrganization[]): MyOrganization | null {
  return orgs.find((o) => o.isOwner && !o.parentOrgId) ?? null;
}
