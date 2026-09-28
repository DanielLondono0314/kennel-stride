// Pesos colombianos sin decimales: 300000 -> "$ 300.000" (antes "$300,000.00",
// formato de EE. UU. — QA E-13).
const formatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea un monto como moneda con separador de miles: 300000 -> "$ 300.000". */
export function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  return formatter.format(Number.isFinite(amount) ? (amount as number) : 0);
}
