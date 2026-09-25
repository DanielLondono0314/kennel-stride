import { z } from "zod";
import { DEFAULT_WEIGHT_SETTINGS, type WeightSettings } from "@/lib/weightTrend";

/**
 * Configuración del Panel de perros por organización
 * (columna organizations.dog_dashboard_config). El centro decide qué secciones
 * y qué datos de cada perro se muestran, y los umbrales de alerta de peso.
 */

export const DASHBOARD_SECTIONS = {
  kpis: "Indicadores",
  weightHealth: "Salud del peso",
  weighInActivity: "Actividad de pesaje",
  planCoverage: "Cobertura de planes",
  feedingMix: "Alimentación",
  attention: "Requieren atención",
  roster: "Listado de perros",
} as const;
export type DashboardSection = keyof typeof DASHBOARD_SECTIONS;

export const CARD_FIELDS = {
  owner: "Dueño",
  breedAge: "Raza y edad",
  weight: "Peso y tendencia",
  plan: "Plan activo",
  feeding: "Alimentación",
  location: "Estancia y perrera",
  health: "Alergias y medicación",
  behavior: "Comportamiento",
  vaccines: "Vacunas",
  lastReport: "Último report card",
} as const;
export type CardField = keyof typeof CARD_FIELDS;

export interface DogDashboardConfig {
  weight: WeightSettings;
  sections: Record<DashboardSection, boolean>;
  cardFields: Record<CardField, boolean>;
}

const allOn = <K extends string>(keys: Record<K, string>) =>
  Object.fromEntries(Object.keys(keys).map((k) => [k, true])) as Record<K, boolean>;

export const DEFAULT_DOG_DASHBOARD_CONFIG: DogDashboardConfig = {
  weight: DEFAULT_WEIGHT_SETTINGS,
  sections: allOn(DASHBOARD_SECTIONS),
  cardFields: { ...allOn(CARD_FIELDS), lastReport: false, vaccines: false },
};

const weightSchema = z.object({
  checkIntervalDays: z.number().int().min(1).max(365),
  alertPct: z.number().min(1).max(50),
  windowDays: z.number().int().min(7).max(365),
}).partial();

const storedSchema = z.object({
  weight: weightSchema.optional(),
  sections: z.record(z.boolean()).optional(),
  cardFields: z.record(z.boolean()).optional(),
});

function pickKnown<K extends string>(defaults: Record<K, boolean>, stored?: Record<string, boolean>) {
  const out = { ...defaults };
  if (stored) for (const k of Object.keys(defaults) as K[]) if (typeof stored[k] === "boolean") out[k] = stored[k];
  return out;
}

/** Mezcla lo guardado con los defaults; valores inválidos o claves viejas se ignoran. */
export function parseDogDashboardConfig(raw: unknown): DogDashboardConfig {
  const parsed = storedSchema.safeParse(raw ?? {});
  if (!parsed.success) return DEFAULT_DOG_DASHBOARD_CONFIG;
  const s = parsed.data;
  const weight = weightSchema.safeParse(s.weight ?? {});
  return {
    weight: { ...DEFAULT_WEIGHT_SETTINGS, ...(weight.success ? weight.data : {}) },
    sections: pickKnown(DEFAULT_DOG_DASHBOARD_CONFIG.sections, s.sections),
    cardFields: pickKnown(DEFAULT_DOG_DASHBOARD_CONFIG.cardFields, s.cardFields),
  };
}
