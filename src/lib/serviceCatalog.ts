import { z } from "zod";
import { categoryOf, isServiceCategory, type ServiceCategory } from "@/lib/reportCardServices";
import { formatCurrency } from "@/lib/currency";

/**
 * Catálogo de servicios de cada centro (organizations.service_types, JSONB).
 * Cada centro define por servicio cómo se vende — por duración, por cantidad
 * o por uso — qué incluye y sus condiciones. Los planes de los perros se
 * crean a partir de este catálogo (fase 2).
 *
 * Retrocompatible: los servicios guardados antes solo tenían {value, label,
 * category}; `normalizeService` completa lo que falte con valores por defecto.
 */

export type BillingMode = "per_use" | "duration" | "quantity";
export type DurationUnit = "days" | "weeks" | "months";
/** En planes por cantidad: qué consume una unidad. */
export type Consumption = "per_day" | "per_visit";

export interface CatalogService {
  value: string;
  label: string;
  category?: string;
  billing: BillingMode;
  duration: { amount: number; unit: DurationUnit } | null;
  quantity: { amount: number; unitLabel: string; consumption: Consumption } | null;
  price: number | null;
  includes: string[];
  conditions: string;
  active: boolean;
}

export const BILLING_LABELS: Record<BillingMode, string> = {
  per_use: "Por uso",
  duration: "Por duración",
  quantity: "Por cantidad",
};

export const BILLING_HELP: Record<BillingMode, string> = {
  per_use: "Se cobra cada vez que se presta el servicio.",
  duration: "Un plan con fecha de inicio y fin (ej. internado de 2 meses, mensualidad).",
  quantity: "Un plan con un número de clases, días o sesiones que se van usando.",
};

export const DURATION_UNIT_LABELS: Record<DurationUnit, [singular: string, plural: string]> = {
  days: ["día", "días"],
  weeks: ["semana", "semanas"],
  months: ["mes", "meses"],
};

export const CONSUMPTION_LABELS: Record<Consumption, string> = {
  per_day: "Cada día de estadía",
  per_visit: "Cada visita o sesión",
};

/** Sugerencias para "Incluye"; cada centro agrega las suyas. */
export const DEFAULT_INCLUDES = [
  "Snacks",
  "Clases grupales",
  "Clases a domicilio",
  "Asesoría por WhatsApp",
  "Reporte por WhatsApp",
  "Transporte",
  "Baño al finalizar",
  "Fotos y videos",
];

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Completa un servicio guardado (quizás de la versión anterior) con los valores por defecto. */
export function normalizeService(raw: Record<string, unknown>): CatalogService {
  const billing = (["per_use", "duration", "quantity"] as const).includes(raw.billing as BillingMode)
    ? (raw.billing as BillingMode)
    : "per_use";
  const d = (raw.duration ?? null) as Record<string, unknown> | null;
  const q = (raw.quantity ?? null) as Record<string, unknown> | null;
  return {
    value: String(raw.value ?? ""),
    label: String(raw.label ?? raw.value ?? ""),
    category: isServiceCategory(raw.category) ? raw.category : undefined,
    billing,
    duration: d && num(d.amount)
      ? { amount: num(d.amount)!, unit: (["days", "weeks", "months"] as const).includes(d.unit as DurationUnit) ? (d.unit as DurationUnit) : "months" }
      : null,
    quantity: q && num(q.amount)
      ? {
          amount: num(q.amount)!,
          unitLabel: typeof q.unitLabel === "string" && q.unitLabel.trim() ? q.unitLabel.trim() : "sesiones",
          consumption: q.consumption === "per_day" ? "per_day" : "per_visit",
        }
      : null,
    price: num(raw.price),
    includes: Array.isArray(raw.includes) ? raw.includes.filter((i): i is string => typeof i === "string" && !!i.trim()) : [],
    conditions: typeof raw.conditions === "string" ? raw.conditions : "",
    active: raw.active !== false,
  };
}

export function categoryForService(s: CatalogService): ServiceCategory {
  return categoryOf(s);
}

/** "2 meses", "10 clases", "Por uso". */
export function billingSummary(s: CatalogService): string {
  if (s.billing === "duration" && s.duration) {
    const [one, many] = DURATION_UNIT_LABELS[s.duration.unit];
    return `${s.duration.amount} ${s.duration.amount === 1 ? one : many}`;
  }
  if (s.billing === "quantity" && s.quantity) return `${s.quantity.amount} ${s.quantity.unitLabel}`;
  return BILLING_LABELS[s.billing];
}

export function priceSummary(s: CatalogService): string | null {
  return s.price != null && s.price > 0 ? formatCurrency(s.price) : null;
}

export const catalogServiceSchema = z
  .object({
    value: z.string().min(1),
    label: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    billing: z.enum(["per_use", "duration", "quantity"]),
    duration: z
      .object({ amount: z.number().int().positive("Indica la duración").max(3650), unit: z.enum(["days", "weeks", "months"]) })
      .nullable(),
    quantity: z
      .object({
        amount: z.number().int().positive("Indica la cantidad").max(10000),
        unitLabel: z.string().trim().min(1, "Indica qué se cuenta (clases, días…)").max(30),
        consumption: z.enum(["per_day", "per_visit"]),
      })
      .nullable(),
    price: z.number().min(0, "El precio no puede ser negativo").max(1_000_000_000).nullable(),
    includes: z.array(z.string().trim().min(1).max(60)).max(30),
    conditions: z.string().max(2000),
    active: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.billing === "duration" && !s.duration) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["duration"], message: "Indica la duración del plan" });
    }
    if (s.billing === "quantity" && !s.quantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Indica la cantidad del plan" });
    }
  });

/** Forma a guardar: sin campos que no aplican a la modalidad. */
export function serializeService(s: CatalogService): Record<string, unknown> {
  return {
    value: s.value,
    label: s.label.trim(),
    ...(s.category ? { category: s.category } : {}),
    billing: s.billing,
    duration: s.billing === "duration" ? s.duration : null,
    quantity: s.billing === "quantity" ? s.quantity : null,
    price: s.price,
    includes: s.includes,
    conditions: s.conditions.trim(),
    active: s.active,
  };
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
