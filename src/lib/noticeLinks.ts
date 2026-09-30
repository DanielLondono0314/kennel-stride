/**
 * Ruta (relativa a la org) del registro al que apunta un aviso, para que al
 * hacer clic se abra ese registro (QA E-10). null si no tiene destino.
 */
export function noticeHref(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "reservation": return `/reservations/${entityId}`;
    case "dog":         return `/dogs/${entityId}`;
    case "customer":    return `/customers/${entityId}`;
    case "invoice":     return "/invoices";
    case "package":     return "/plans";
    case "task":        return `/tasks?task=${entityId}`;
    default:            return null;
  }
}
