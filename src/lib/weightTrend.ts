import { differenceInCalendarDays } from "date-fns";
import { parseDateOnly } from "@/lib/age";

/**
 * Análisis de la hoja de pesos de un perro. Funciones puras (sin Supabase) para
 * que la pestaña Peso, el Panel de perros y los tests usen el mismo criterio.
 */

export interface WeightPoint {
  /** yyyy-MM-dd */
  date: string;
  weight: number;
}

export interface WeightSettings {
  /** Cada cuántos días debería pesarse un perro activo. */
  checkIntervalDays: number;
  /** Variación (%) que dispara alerta, en cualquier dirección. */
  alertPct: number;
  /** Ventana (días) contra la que se compara la última pesada. */
  windowDays: number;
}

export const DEFAULT_WEIGHT_SETTINGS: WeightSettings = {
  checkIntervalDays: 14,
  alertPct: 5,
  windowDays: 30,
};

/**
 * - loss / gain: la variación en la ventana supera el umbral.
 * - stable: hay con qué comparar y está dentro del umbral.
 * - single: solo hay una fecha de pesaje (sin tendencia todavía).
 * - no_data: nunca se ha pesado.
 */
export type WeightStatus = "loss" | "gain" | "stable" | "single" | "no_data";

export interface WeightAnalysis {
  points: WeightPoint[];
  latest: WeightPoint | null;
  /** Pesada contra la que se mide la variación. */
  baseline: WeightPoint | null;
  changeKg: number | null;
  changePct: number | null;
  /** Ritmo de cambio entre baseline y la última pesada. */
  kgPerWeek: number | null;
  status: WeightStatus;
  daysSinceLast: number | null;
  /** Nunca pesado, o la última pesada es más vieja que checkIntervalDays. */
  isOverdue: boolean;
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** Ordena por fecha y promedia varias pesadas del mismo día. */
export function normalizeWeightPoints(points: WeightPoint[]): WeightPoint[] {
  const byDate = new Map<string, number[]>();
  for (const p of points) {
    if (!Number.isFinite(p.weight) || p.weight <= 0) continue;
    const key = p.date.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(p.weight);
    byDate.set(key, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ws]) => ({ date, weight: round(ws.reduce((s, w) => s + w, 0) / ws.length, 2) }));
}

export function analyzeWeight(
  rawPoints: WeightPoint[],
  settings: WeightSettings = DEFAULT_WEIGHT_SETTINGS,
  today: Date = new Date(),
): WeightAnalysis {
  const points = normalizeWeightPoints(rawPoints);
  const latest = points.at(-1) ?? null;

  if (!latest) {
    return {
      points, latest: null, baseline: null, changeKg: null, changePct: null,
      kgPerWeek: null, status: "no_data", daysSinceLast: null, isOverdue: true,
    };
  }

  const latestDate = parseDateOnly(latest.date);
  const daysSinceLast = Math.max(0, differenceInCalendarDays(today, latestDate));
  const isOverdue = daysSinceLast > settings.checkIntervalDays;

  // Baseline: la pesada más reciente que tenga al menos `windowDays` de
  // antigüedad respecto a la última. Si el historial es más corto que la
  // ventana, la primera pesada — así una pérdida rápida en 10 días también alerta.
  const previous = points.slice(0, -1);
  const baseline =
    [...previous].reverse().find(
      (p) => differenceInCalendarDays(latestDate, parseDateOnly(p.date)) >= settings.windowDays,
    ) ?? previous[0] ?? null;

  if (!baseline) {
    return {
      points, latest, baseline: null, changeKg: null, changePct: null,
      kgPerWeek: null, status: "single", daysSinceLast, isOverdue,
    };
  }

  const changeKg = round(latest.weight - baseline.weight, 2);
  const changePct = round((changeKg / baseline.weight) * 100, 1);
  const spanDays = Math.max(1, differenceInCalendarDays(latestDate, parseDateOnly(baseline.date)));
  const kgPerWeek = round((changeKg / spanDays) * 7, 2);

  const status: WeightStatus =
    changePct <= -settings.alertPct ? "loss" : changePct >= settings.alertPct ? "gain" : "stable";

  return { points, latest, baseline, changeKg, changePct, kgPerWeek, status, daysSinceLast, isOverdue };
}

export const WEIGHT_STATUS_LABELS: Record<WeightStatus, string> = {
  loss: "Pérdida de peso",
  gain: "Aumento de peso",
  stable: "Peso estable",
  single: "Un solo pesaje",
  no_data: "Sin pesajes",
};

/** "+1.2 kg" / "−0.8 kg" con signo tipográfico. */
export function formatSignedKg(kg: number): string {
  const abs = Math.abs(kg).toLocaleString("es", { maximumFractionDigits: 1 });
  return `${kg > 0 ? "+" : kg < 0 ? "−" : ""}${abs} kg`;
}

export function formatSignedPct(pct: number): string {
  const abs = Math.abs(pct).toLocaleString("es", { maximumFractionDigits: 1 });
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${abs}%`;
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString("es", { maximumFractionDigits: 1 })} kg`;
}
