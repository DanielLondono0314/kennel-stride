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
  /** Fecha de venta: el ingreso del plan cuenta este día en Reportes. */
  sold_on: string;
  includes: string[];
  conditions: string;
  notes: string | null;
  status: "active" | "finished" | "cancelled";
  ended_at: string | null;
  created_at: string;
  /** Último recordatorio al dueño y por qué situación (por vencer, vencido, agotado). */
  reminded_at?: string | null;
  reminded_state?: ReminderState | null;
}

export type ReminderState = "expiring" | "expired" | "depleted";

/** Un plan vencido deja de pedir recordatorio pasados estos días. */
export const REMINDER_EXPIRED_DAYS = 7;

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

/**
 * Unidades que descuenta un check-out (espejo de complete_checkout):
 * per_day = días desde el check-in hasta hoy, incluidos; per_visit = 1.
 * Los planes por duración no descuentan nada.
 */
export function checkoutUnits(p: DogPlan, checkIn: Date, today = new Date()): number {
  if (p.billing !== "quantity") return 0;
  if (p.consumption === "per_day") return Math.max(1, differenceInCalendarDays(today, checkIn) + 1);
  return 1;
}

export interface PlanCoverage {
  plan: DogPlan;
  /** Unidades que usaría este check-out (0 si es por duración). */
  units: number;
  /** Si al plan le alcanza; si no, se explica en `reason`. */
  ok: boolean;
  reason: string | null;
}

/**
 * Planes del perro que cubren una reserva: mismo servicio o misma categoría
 * (un plan de internado cubre las estadías de internado), vigentes el día
 * que empezó la reserva. Primero los que alcanzan y vencen antes.
 */
export function plansCoveringReservation(
  plans: DogPlan[],
  res: { serviceType: string; category: string | null; startDate: Date; checkIn: Date },
  today = new Date()
): PlanCoverage[] {
  const resDay = format(res.startDate, "yyyy-MM-dd");
  return plans
    .filter((p) => p.status === "active")
    .filter((p) => p.service_type === res.serviceType || (!!p.category && p.category === res.category))
    .filter((p) => differenceInCalendarDays(parseDateOnly(p.start_date), today) <= 0)
    .filter((p) => !p.end_date || p.end_date >= resDay)
    .map((plan) => {
      const units = checkoutUnits(plan, res.checkIn, today);
      const left = remainingUnits(plan);
      const ok = left === null || units <= left;
      return {
        plan,
        units,
        ok,
        reason: ok ? null : `Solo le quedan ${left} ${plan.unit_label ?? "unidades"} y esta estadía usa ${units}`,
      };
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok) || (a.plan.end_date ?? "9999").localeCompare(b.plan.end_date ?? "9999"));
}

/** Uso registrado de un plan por cantidad (dog_plan_usage). */
export interface DogPlanUsage {
  id: string;
  plan_id: string;
  used_on: string;
  quantity: number;
  note: string | null;
  reservation_id: string | null;
  created_at: string;
}

/** Mensaje de WhatsApp para avisarle al dueño que el plan vence o se agotó. */
export function planReminderMessage(p: DogPlan, dogName: string, ownerFirstName?: string | null, today = new Date()): string {
  const state = planState(p, today);
  const hi = ownerFirstName ? `Hola ${ownerFirstName}` : "Hola";
  const fmt = (d: string) => format(parseDateOnly(d), "d 'de' MMMM", { locale: es });
  const plan = `el plan ${p.service_label} de ${dogName}`;
  if (state === "expired") return `${hi}, te contamos que ${plan} venció el ${fmt(p.end_date!)}. ¿Quieres renovarlo?`;
  if (state === "depleted") return `${hi}, te contamos que ${plan} ya usó todas sus ${p.unit_label ?? "unidades"}. ¿Quieres renovarlo?`;
  const units = remainingUnits(p);
  const left = daysLeft(p, today);
  if (units !== null && units <= EXPIRING_UNITS && !(left !== null && left <= EXPIRING_DAYS)) {
    return `${hi}, te contamos que al plan ${p.service_label} de ${dogName} le ${units === 1 ? "queda" : "quedan"} ${units} ${p.unit_label ?? "unidades"}. ¿Quieres renovarlo?`;
  }
  return `${hi}, te contamos que ${plan} vence el ${fmt(p.end_date!)}. ¿Quieres renovarlo?`;
}

/**
 * Situación por la que hay que avisarle al dueño, o null si no hace falta:
 * por vencer, vencido (hace ≤ 7 días) o agotado, y aún no avisado por ESA
 * situación. Así se avisa una vez por situación, no todos los días.
 */
export function reminderDue(p: DogPlan, today = new Date()): ReminderState | null {
  if (p.status !== "active") return null;
  const state = planState(p, today);
  if (state !== "expiring" && state !== "expired" && state !== "depleted") return null;
  if (state === "expired" && (daysLeft(p, today) ?? 0) < -REMINDER_EXPIRED_DAYS) return null;
  return p.reminded_state === state ? null : state;
}

export const REMINDER_STATE_LABELS: Record<ReminderState, string> = {
  expiring: "Por vencer",
  expired: "Vencido",
  depleted: "Agotado",
};

/** El plan que se muestra como "actual": el vigente que vence antes. */
export function currentPlan(plans: DogPlan[], today = new Date()): DogPlan | null {
  const current = plans.filter((p) => isCurrent(planState(p, today)));
  current.sort((a, b) => (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"));
  return current[0] ?? null;
}
