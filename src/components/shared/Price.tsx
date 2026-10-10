import { usePermission } from "@/hooks/usePermission";
import { formatCurrency } from "@/lib/currency";

/**
 * Un monto, visible solo con el permiso de verlo ("Ver precios y montos" por
 * defecto; saldos y facturas usan "Ver facturas").
 */
export function Price({
  value,
  perm = "prices.view",
  fallback = "—",
}: {
  value: number | string | null | undefined;
  perm?: "prices.view" | "invoices.view" | "finance.view_income";
  fallback?: string;
}) {
  const canSee = usePermission(perm);
  return <>{canSee ? formatCurrency(value) : fallback}</>;
}
