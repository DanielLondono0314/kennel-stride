const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un monto como moneda con separador de miles: 300000 -> "$300,000.00". */
export function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  return formatter.format(Number.isFinite(amount) ? (amount as number) : 0);
}
