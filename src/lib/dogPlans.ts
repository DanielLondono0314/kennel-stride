import { addDays, addMonths, addWeeks, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateOnly } from "@/lib/age";
import type { DurationUnit } from "@/lib/serviceCatalog";

/** Plan de un perro tal como se guarda (dog_plans). */
export interface DogPlan {
  id: string;
  dog_id: string;
  customer_id: string | null;
  service_type: string;
  service_label: string;
  category: string | null;
  billing: "duration" | "quantity";
  start_date: string;
  end_date: string | null;
  quantity_total: number | null;
  quantity_used: number;
  unit_label: string | null;
  consumption: string | null;
  price: number;
  includes: string[];
  conditions: string;
  notes: string | null;
  status: "active" | "finished" | "cancelled";
  ended_at: string | null;
  created_at: string;
}

/**
 * Estado que se muestra. `status` en la base solo distingue activo /
 * finalizado / cancelado; vencido, agotado y "por vencer" se derivan de las
 * fechas y el conteo.
 */
export type PlanState = "upcoming" | "active" | "expiring" | "expired" | "depleted" | "finished" | "cancelled";

export const PLAN_STATE_LABELS: Record<PlanState, string> = {
  upcoming: "Por iniciar",
  active: "Vigente",
  expiring: "Por vencer",
  expired: "Vencido",
  depleted: "Agotado",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

/** Días antes del fin en que un plan pasa a "por vencer". */
export const EXPIRING_DAYS = 7;
/** Unidades restantes con las que un plan por cantidad pasa a "por vencer". */
export const EXPIRING_UNITS = 2;

export function remainingUnits(p: Pick<DogPlan, "quantity_total" | "quantity_used">): number | null {
  return p.quantity_total == null ? null : Math.max(p.quantity_total - p.quantity_used, 0);
}

export function daysLeft(p: Pick<DogPlan, "end_date">, today = new Date()): number | null {
  return p.end_date ? differenceInCalendarDays(parseDateOnly(p.end_date), today) : null;
}

export function planState(p: DogPlan, today = new Date()): PlanState {
  if (p.status === "cancelled") return "cancelled";
  if (p.status === "finished") return "finished";
  if (differenceInCalendarDays(parseDateOnly(p.start_date), today) > 0) return "upcoming";
  const left = daysLeft(p, today);
  if (left !== null && left < 0) return "expired";
  const units = remainingUnits(p);
  if (p.billing === "quantity" && units === 0) return "depleted";
  if ((left !== null && left <= EXPIRING_DAYS) || (units !== null && units <= EXPIRING_UNITS)) return "expiring";
  return "active";
}

/** Un plan "cuenta" como plan actual del perro. */
export function isCurrent(state: PlanState): boolean {
  return state === "active" || state === "expiring" || state === "upcoming";
}

/** Fin sugerido: inicio + duración, menos un día (2 meses desde el 2 sep → 1 nov). */
export function computeEndDate(start: string, amount: number, unit: DurationUnit): string {
  const d = parseDateOnly(start);
  const end = unit === "days" ? addDays(d, amount) : unit === "weeks" ? addWeeks(d, amount) : addMonths(d, amount);
  return format(addDays(end, -1), "yyyy-MM-dd");
}

/** "Vigente hasta 31 oct", "Quedan 6 de 10 clases", "Vence en 3 días"… */
export function planProgressText(p: DogPlan, today = new Date()): string {
  const state = planState(p, today);
  const fmt = (d: string) => format(parseDateOnly(d), "d MMM yyyy", { locale: es });
  if (state === "cancelled") return "Cancelado";
  if (state === "finished") return p.ended_at ? `Finalizado el ${format(new Date(p.ended_at), "d MMM yyyy", { locale: es })}` : "Finalizado";
  if (state === "upcoming") return `Empieza el ${fmt(p.start_date)}`;
  if (state === "expired") return `Venció el ${fmt(p.end_date!)}`;
  if (p.billing === "quantity") {
    const units = remainingUnits(p)!;
    const unit = p.unit_label ?? "unidades";
    const base = units === 0 ? `Usó las ${p.quantity_total} ${unit}` : `Quedan ${units} de ${p.quantity_total} ${unit}`;
    return p.end_date ? `${base} · hasta ${fmt(p.end_date)}` : base;
  }
  const left = daysLeft(p, today)!;
  if (left === 0) return "Vence hoy";
  if (left <= EXPIRING_DAYS) return `Vence en ${left} ${left === 1 ? "día" : "días"} (${fmt(p.end_date!)})`;
  return `Vigente hasta ${fmt(p.end_date!)}`;
}

/** Porcentaje consumido (tiempo o unidades), 0–100. */
export function planProgressPct(p: DogPlan, today = new Date()): number {
  if (p.billing === "quantity" && p.quantity_total) return Math.min(100, Math.round((p.quantity_used / p.quantity_total) * 100));
  if (!p.end_date) return 0;
  const total = differenceInCalendarDays(parseDateOnly(p.end_date), parseDateOnly(p.start_date)) + 1;
  const elapsed = differenceInCalendarDays(today, parseDateOnly(p.start_date)) + 1;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

/** El plan que se muestra como "actual": el vigente que vence antes. */
export function currentPlan(plans: DogPlan[], today = new Date()): DogPlan | null {
  const current = plans.filter((p) => isCurrent(planState(p, today)));
  current.sort((a, b) => (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"));
  return current[0] ?? null;
}
