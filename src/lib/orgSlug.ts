/** Mismo patrón que valida el servidor (assert_new_org_allowed): 3–40, minúsculas, números y guiones. */
export const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Convierte un nombre en un slug de URL ("Spa Norte" → "spa-norte"). */
export function toOrgSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
