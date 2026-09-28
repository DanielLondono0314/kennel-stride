import { startOfToday } from "date-fns";
import { parseDateOnly } from "@/lib/age";
/**
 * Nada en el backend marca un paquete como 'expired' al pasar su fecha de
 * vencimiento (la columna se queda en 'active' salvo que se agote). El estado
 * real para mostrar/filtrar se deriva aquí en vez de confiar en pkg.status.
 */
export function getEffectivePackageStatus(pkg: { status: string; expires_at: string }): string {
  // expires_at es una fecha (sin hora): el paquete vale TODO ese día. Antes
  // new Date("YYYY-MM-DD") = medianoche UTC = 7 p. m. del día anterior en
  // Colombia, y el paquete aparecía vencido un día antes.
  if (pkg.status === "active" && parseDateOnly(pkg.expires_at) < startOfToday()) return "expired";
  return pkg.status;
}
