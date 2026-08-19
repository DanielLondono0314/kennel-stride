/**
 * Nada en el backend marca un paquete como 'expired' al pasar su fecha de
 * vencimiento (la columna se queda en 'active' salvo que se agote). El estado
 * real para mostrar/filtrar se deriva aquí en vez de confiar en pkg.status.
 */
export function getEffectivePackageStatus(pkg: { status: string; expires_at: string }): string {
  if (pkg.status === "active" && new Date(pkg.expires_at) < new Date()) return "expired";
  return pkg.status;
}
