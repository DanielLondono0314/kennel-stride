/**
 * Etiquetas y lectura segura de la información de cuidado de un perro
 * (alimentación, agresividad, alergias, medicación). Las columnas `feeding` y
 * `aggression_details` son JSONB, así que se leen defensivamente.
 */

export const FOOD_TYPE_LABELS: Record<string, string> = { seco: "Seco", humedo: "Húmedo", crudo: "Crudo", mixto: "Mixto" };
export const SEVERITY_LABELS: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };
export const ALLERGY_TYPE_LABELS: Record<string, string> = { comida: "Comida", ambiental: "Ambiental", medicamento: "Medicamento" };
export const MED_ROUTE_LABELS: Record<string, string> = { oral: "Oral", topica: "Tópica", inyectable: "Inyectable" };

export interface Feeding {
  foodType: string | null;
  brand: string | null;
  mealsPerDay: number | null;
  portion: string | null;
  instructions: string | null;
}

export interface Aggression {
  severity: string | null;
  handling: string | null;
  requiresMuzzle: boolean;
  handleAlone: boolean;
  noOtherDogs: boolean;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function readFeeding(raw: unknown): Feeding | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  const amount = num(f.portion_amount);
  const feeding: Feeding = {
    foodType: str(f.food_type),
    brand: str(f.brand),
    mealsPerDay: num(f.meals_per_day),
    portion: amount !== null ? `${amount} ${str(f.portion_unit) ?? ""}`.trim() : null,
    instructions: str(f.instructions),
  };
  return Object.values(feeding).some((v) => v !== null) ? feeding : null;
}

export function readAggression(raw: unknown): Aggression | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    severity: str(a.severity),
    handling: str(a.handling),
    requiresMuzzle: a.requires_muzzle === true,
    handleAlone: a.handle_alone === true,
    noOtherDogs: a.no_other_dogs === true,
  };
}

/** "Seco · 2 comidas/día · 150 g" */
export function feedingSummary(f: Feeding | null): string | null {
  if (!f) return null;
  const parts = [
    f.foodType ? FOOD_TYPE_LABELS[f.foodType] ?? f.foodType : null,
    f.mealsPerDay ? `${f.mealsPerDay} ${f.mealsPerDay === 1 ? "comida" : "comidas"}/día` : null,
    f.portion,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
