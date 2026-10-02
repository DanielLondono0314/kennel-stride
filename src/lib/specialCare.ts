/**
 * "Cuidados especiales": perros marcados con medicación, alergias o manejo
 * especial (agresividad). Una sola definición para el Panel de perros y la
 * Clínica, para que ambos muestren la misma cifra.
 */
export interface SpecialCareFlags {
  medication: boolean;
  allergies: boolean;
  aggressive: boolean;
}

export const hasSpecialCare = (f: SpecialCareFlags) => f.medication || f.allergies || f.aggressive;

export interface SpecialCareSummary {
  total: number;
  medication: number;
  allergies: number;
  aggressive: number;
}

export function summarizeSpecialCare(flags: SpecialCareFlags[]): SpecialCareSummary {
  return {
    total: flags.filter(hasSpecialCare).length,
    medication: flags.filter((f) => f.medication).length,
    allergies: flags.filter((f) => f.allergies).length,
    aggressive: flags.filter((f) => f.aggressive).length,
  };
}

/** "3 con medicación · 9 de manejo" (sin los ceros); "Ninguno" si no hay. */
export function specialCareDetail(s: SpecialCareSummary): string {
  const parts = [
    s.medication && `${s.medication} con medicación`,
    s.allergies && `${s.allergies} con alergias`,
    s.aggressive && `${s.aggressive} de manejo especial`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Ninguno";
}
