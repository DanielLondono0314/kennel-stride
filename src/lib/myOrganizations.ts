/** Un centro al que pertenece el usuario, con su rol en ese centro. */
export interface MyOrganization {
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Nombre del rol (personalizado o de sistema) en ese centro. */
  roleName: string;
  isWorker: boolean;
}

export interface MembershipRow {
  role: string | null;
  org_roles: { name: string | null; access_type: string | null } | null;
  organizations: { slug: string; name: string; logo_url: string | null } | null;
}

const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  front_desk: "Recepción",
  worker: "Trabajador",
};

export function toMyOrganization(row: MembershipRow): MyOrganization | null {
  if (!row.organizations) return null;
  const legacy = row.role ?? "";
  return {
    slug: row.organizations.slug,
    name: row.organizations.name,
    logoUrl: row.organizations.logo_url,
    roleName: row.org_roles?.name || LEGACY_ROLE_LABELS[legacy] || "Miembro",
    isWorker: row.org_roles ? row.org_roles.access_type === "worker" : legacy === "worker",
  };
}
