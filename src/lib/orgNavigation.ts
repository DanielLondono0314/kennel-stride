/** Ruta de la pantalla "Mis centros" (slug reservado en create_organization). */
export const SELECT_ORG_PATH = "/centros";

const LAST_ORG_KEY = "tailsup:lastOrgSlug";

/**
 * Destino tras iniciar sesión: sin centros → crear uno; con uno → directo a él
 * (RoleHome decide si es vista de trabajador o de admin); con varios → elegir.
 */
export function postLoginPath(slugs: string[]): string {
  if (slugs.length === 0) return "/onboarding";
  if (slugs.length === 1) return `/${slugs[0]}`;
  return SELECT_ORG_PATH;
}

/** Último centro abierto en este navegador, para destacarlo en "Mis centros". */
export function getLastOrgSlug(): string | null {
  try {
    return localStorage.getItem(LAST_ORG_KEY);
  } catch {
    return null;
  }
}

export function setLastOrgSlug(slug: string) {
  try {
    localStorage.setItem(LAST_ORG_KEY, slug);
  } catch {
    // localStorage no disponible (modo privado): solo se pierde el destacado.
  }
}
