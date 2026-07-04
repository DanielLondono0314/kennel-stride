import { differenceInMonths, differenceInYears } from "date-fns";

/**
 * Parsea una fecha `YYYY-MM-DD` (columna `date` de Postgres) como fecha LOCAL.
 *
 * `new Date("YYYY-MM-DD")` la interpretaría como medianoche UTC; en husos
 * negativos (p. ej. América) eso retrocede al día anterior y desplaza la
 * edad un día en el borde de cumpleaños/mes.
 */
export function parseDateOnly(value: string): Date {
  const [datePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Edad legible en español a partir de una fecha de nacimiento `YYYY-MM-DD`. */
export function getAge(birthDate?: string | null, unknownLabel = "—"): string {
  if (!birthDate) return unknownLabel;
  const bd = parseDateOnly(birthDate);
  const now = new Date();
  const years = differenceInYears(now, bd);
  if (years > 0) return `${years} año${years !== 1 ? "s" : ""}`;
  const months = Math.max(0, differenceInMonths(now, bd));
  return `${months} mes${months !== 1 ? "es" : ""}`;
}
