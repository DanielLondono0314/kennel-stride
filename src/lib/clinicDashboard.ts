// Panel de clínica: a partir de la historia clínica de cada perro arma las
// alertas (vacunas o desparasitaciones vencidas, controles pendientes,
// condiciones activas, novedades de las rondas…), la agenda de próximas
// fechas y quién está en tratamiento. Lógica pura: la página solo pinta.

import { addDays, differenceInCalendarDays, format } from "date-fns";
import { parseDateOnly } from "@/lib/age";
import { hasSpecialCare, summarizeSpecialCare, type SpecialCareFlags, type SpecialCareSummary } from "@/lib/specialCare";

// ── Reglas ────────────────────────────────────────────────────────────────────

/** Ventana de "próximo" para vacunas, desparasitaciones y controles. */
export const DUE_SOON_DAYS = 30;
/** Una novedad de ronda o una consulta cuentan como recientes estos días. */
export const RECENT_DAYS = 7;
/** Un control que no se hizo deja de alertar pasado este tiempo (ya no es accionable). */
export const STALE_CONTROL_DAYS = 60;
/** Si la vacuna no trae próxima dosis, se estima anual. */
export const VACCINE_DEFAULT_DAYS = 365;
/** Si la desparasitación no trae próxima dosis, se estima cada 3 meses. */
export const DEWORMING_DEFAULT_DAYS = 90;

// ── Datos de entrada ──────────────────────────────────────────────────────────

export interface ClinicDogBase {
  id: string;
  name: string;
  breed: string;
  photoUrl: string | null;
  owner: { id: string; name: string; phone: string | null } | null;
  inCenter: boolean;
  /** Estado del peso según el Panel de perros. */
  weightStatus: "loss" | "gain" | "stable" | "single" | "no_data";
  weightChangePct: number | null;
  allergies: { allergen: string; severity: string | null }[];
  /** Marcas del perro (medicación, alergias, manejo): igual que en el Panel de perros. */
  flags: SpecialCareFlags;
}

export interface ClinicRaw {
  consultations: { id: string; dog_id: string; record_date: string; record_type: string; reason: string | null; diagnosis: string | null; veterinarian: string | null; next_appointment: string | null }[];
  vaccines: { dog_id: string; vaccine_name: string; date_administered: string; next_dose_date: string | null }[];
  dewormings: { dog_id: string; product_name: string; product_type: string; date_administered: string; next_dose_date: string | null }[];
  conditions: { dog_id: string; condition_name: string; status: string; severity: string; treatment: string | null; diagnosed_date: string | null }[];
  medications: { dog_id: string; name: string; dose: string | null; frequency: string | null; start_date: string | null; end_date: string | null }[];
  /** Entradas de rondas de bienestar con alguna marca o nota. */
  welfare: { dog_id: string; checked_at: string; flags: string[]; notes: string | null }[];
}

// ── Resultado ────────────────────────────────────────────────────────────────

export type DueState = "overdue" | "due_soon" | "ok";

export interface DueItem {
  name: string;
  lastDate: string;
  nextDate: string;
  /** La próxima fecha no venía en el registro: se calculó con el intervalo por defecto. */
  estimated: boolean;
  state: DueState;
  daysLeft: number;
}

export type AlertKind =
  | "welfare" | "condition_severe" | "vaccine_overdue" | "deworming_overdue" | "control_overdue"
  | "weight_loss" | "condition_active" | "treatment" | "recent_consult" | "no_vaccines";

export interface ClinicAlert {
  kind: AlertKind;
  /** 0 = urgente, 1 = pendiente, 2 = seguimiento. */
  severity: 0 | 1 | 2;
  label: string;
}

export interface ClinicDog extends ClinicDogBase {
  lastConsult: { date: string; reason: string | null; diagnosis: string | null; veterinarian: string | null } | null;
  /** Próximo control indicado en la última consulta que lo trae (null si ya se hizo o no hay). */
  nextControl: { date: string; overdue: boolean } | null;
  vaccines: DueItem[];
  deworming: DueItem | null;
  conditions: { name: string; status: string; severity: string; treatment: string | null; since: string | null }[];
  medications: { name: string; dose: string | null; frequency: string | null; until: string | null }[];
  novelties: { date: string; flags: string[]; notes: string | null }[];
  alerts: ClinicAlert[];
  inTreatment: boolean;
}

export type EventType = "vaccine" | "deworming" | "control" | "treatment_end";

export interface ClinicEvent {
  date: string;
  type: EventType;
  dogId: string;
  dogName: string;
  label: string;
  estimated: boolean;
  overdue: boolean;
}

export const EVENT_LABELS: Record<EventType, string> = {
  vaccine: "Vacuna",
  deworming: "Desparasitación",
  control: "Control",
  treatment_end: "Fin de tratamiento",
};

export const RECORD_TYPE_LABELS: Record<string, string> = {
  admission_checkup: "Chequeo de ingreso",
  consultation: "Consulta",
  surgery: "Cirugía",
  emergency: "Emergencia",
  checkup: "Control",
  dental: "Dental",
  laboratory: "Laboratorio",
  imaging: "Imagen",
};

export const CONDITION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  chronic: "Crónica",
  monitoring: "En observación",
  resolved: "Resuelta",
};

export const CONDITION_SEVERITY_LABELS: Record<string, string> = {
  mild: "Leve",
  moderate: "Moderada",
  severe: "Severa",
};

// ── Cálculo ──────────────────────────────────────────────────────────────────

function group<T extends { dog_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.dog_id, [...(m.get(r.dog_id) ?? []), r]);
  return m;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function dueItem(name: string, lastDate: string, nextDate: string | null, defaultDays: number, today: Date): DueItem {
  const estimated = !nextDate;
  const next = nextDate ?? iso(addDays(parseDateOnly(lastDate), defaultDays));
  const daysLeft = differenceInCalendarDays(parseDateOnly(next), today);
  return {
    name,
    lastDate,
    nextDate: next,
    estimated,
    daysLeft,
    state: daysLeft < 0 ? "overdue" : daysLeft <= DUE_SOON_DAYS ? "due_soon" : "ok",
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function daysText(days: number): string {
  if (days === 0) return "hoy";
  return days < 0 ? `hace ${plural(-days, "día", "días")}` : `en ${plural(days, "día", "días")}`;
}

export interface RecentConsult {
  id: string;
  dogId: string;
  dogName: string;
  date: string;
  type: string;
  reason: string | null;
  diagnosis: string | null;
  veterinarian: string | null;
}

export function buildClinicDashboard(
  dogs: ClinicDogBase[],
  raw: ClinicRaw,
  today = new Date(),
): { dogs: ClinicDog[]; events: ClinicEvent[]; recentConsults: RecentConsult[] } {
  const todayStr = iso(today);
  const recentFrom = iso(addDays(today, -RECENT_DAYS));
  const consults = group(raw.consultations);
  const vaccines = group(raw.vaccines);
  const dewormings = group(raw.dewormings);
  const conditions = group(raw.conditions);
  const meds = group(raw.medications);
  const welfare = group(raw.welfare);
  const events: ClinicEvent[] = [];

  const out = dogs.map<ClinicDog>((dog) => {
    const alerts: ClinicAlert[] = [];
    const event = (e: Omit<ClinicEvent, "dogId" | "dogName">) => events.push({ ...e, dogId: dog.id, dogName: dog.name });

    // Consultas: la última y el próximo control pendiente.
    const dogConsults = [...(consults.get(dog.id) ?? [])].sort((a, b) => b.record_date.localeCompare(a.record_date));
    const last = dogConsults[0] ?? null;
    const withControl = dogConsults.find((c) => c.next_appointment);
    let nextControl: ClinicDog["nextControl"] = null;
    if (withControl?.next_appointment) {
      // Si hubo una consulta el día del control o después, el control ya se hizo.
      const done = dogConsults.some((c) => c.record_date >= withControl.next_appointment! && c.id !== withControl.id);
      const days = differenceInCalendarDays(parseDateOnly(withControl.next_appointment), today);
      if (!done && days >= -STALE_CONTROL_DAYS) {
        const overdue = days < 0;
        nextControl = { date: withControl.next_appointment, overdue };
        event({ date: withControl.next_appointment, type: "control", label: withControl.reason ? `Control: ${withControl.reason}` : "Control", estimated: false, overdue });
        if (overdue) alerts.push({ kind: "control_overdue", severity: 1, label: `Control vencido ${daysText(days)}` });
      }
    }
    const recentConsults = dogConsults.filter((c) => c.record_date >= recentFrom && c.record_date <= todayStr);
    if (recentConsults.length) {
      const c = recentConsults[0];
      alerts.push({ kind: "recent_consult", severity: 2, label: `Consulta reciente: ${c.diagnosis || c.reason || "sin motivo"}` });
    }

    // Vacunas: la aplicación más reciente de cada una define la próxima dosis.
    const latestVaccine = new Map<string, ClinicRaw["vaccines"][number]>();
    for (const v of vaccines.get(dog.id) ?? []) {
      const key = v.vaccine_name.trim().toLowerCase();
      const prev = latestVaccine.get(key);
      if (!prev || v.date_administered > prev.date_administered) latestVaccine.set(key, v);
    }
    const dogVaccines = [...latestVaccine.values()]
      .map((v) => dueItem(v.vaccine_name, v.date_administered, v.next_dose_date, VACCINE_DEFAULT_DAYS, today))
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    for (const v of dogVaccines) event({ date: v.nextDate, type: "vaccine", label: v.name, estimated: v.estimated, overdue: v.state === "overdue" });
    const overdueVaccines = dogVaccines.filter((v) => v.state === "overdue");
    if (overdueVaccines.length) {
      alerts.push({ kind: "vaccine_overdue", severity: 0, label: `Vacuna vencida: ${overdueVaccines.map((v) => v.name).join(", ")}` });
    }
    if (dogVaccines.length === 0) alerts.push({ kind: "no_vaccines", severity: 2, label: "Sin vacunas registradas" });

    // Desparasitación: la más reciente.
    const lastDeworm = [...(dewormings.get(dog.id) ?? [])].sort((a, b) => b.date_administered.localeCompare(a.date_administered))[0];
    const deworming = lastDeworm
      ? dueItem(lastDeworm.product_name, lastDeworm.date_administered, lastDeworm.next_dose_date, DEWORMING_DEFAULT_DAYS, today)
      : null;
    if (deworming) {
      event({ date: deworming.nextDate, type: "deworming", label: deworming.name, estimated: deworming.estimated, overdue: deworming.state === "overdue" });
      if (deworming.state === "overdue") {
        alerts.push({ kind: "deworming_overdue", severity: 1, label: `Desparasitación vencida ${daysText(deworming.daysLeft)}${deworming.estimated ? " (estimada)" : ""}` });
      }
    }

    // Condiciones sin resolver y medicación vigente = en tratamiento.
    const dogConditions = (conditions.get(dog.id) ?? [])
      .filter((c) => c.status !== "resolved")
      .map((c) => ({ name: c.condition_name, status: c.status, severity: c.severity, treatment: c.treatment, since: c.diagnosed_date }));
    const severe = dogConditions.filter((c) => c.severity === "severe" && c.status !== "monitoring");
    if (severe.length) alerts.push({ kind: "condition_severe", severity: 0, label: `Condición severa: ${severe.map((c) => c.name).join(", ")}` });
    const others = dogConditions.filter((c) => !severe.includes(c));
    if (others.length) alerts.push({ kind: "condition_active", severity: 1, label: `${others.length === 1 ? "Condición" : "Condiciones"}: ${others.map((c) => c.name).join(", ")}` });

    const dogMeds = (meds.get(dog.id) ?? [])
      .filter((m) => (!m.start_date || m.start_date <= todayStr) && (!m.end_date || m.end_date >= todayStr))
      .map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency, until: m.end_date }));
    for (const m of dogMeds) {
      if (m.until) event({ date: m.until, type: "treatment_end", label: m.name, estimated: false, overdue: false });
    }
    if (dogMeds.length) alerts.push({ kind: "treatment", severity: 2, label: `En tratamiento: ${dogMeds.map((m) => m.name).join(", ")}` });

    // Novedades de las rondas de bienestar recientes.
    const novelties = (welfare.get(dog.id) ?? [])
      .filter((w) => w.checked_at.slice(0, 10) >= recentFrom && (w.flags.length > 0 || w.notes?.trim()))
      .sort((a, b) => b.checked_at.localeCompare(a.checked_at))
      .map((w) => ({ date: w.checked_at, flags: w.flags, notes: w.notes }));
    const flagged = novelties.filter((n) => n.flags.length > 0);
    if (flagged.length) {
      alerts.push({ kind: "welfare", severity: 0, label: `Novedad en ronda: ${[...new Set(flagged.flatMap((n) => n.flags))].join(", ")}` });
    }

    if (dog.weightStatus === "loss") {
      alerts.push({ kind: "weight_loss", severity: 1, label: `Pérdida de peso${dog.weightChangePct !== null ? ` (${dog.weightChangePct.toFixed(1)}%)` : ""}` });
    }

    alerts.sort((a, b) => a.severity - b.severity);
    return {
      ...dog,
      lastConsult: last ? { date: last.record_date, reason: last.reason, diagnosis: last.diagnosis, veterinarian: last.veterinarian } : null,
      nextControl,
      vaccines: dogVaccines,
      deworming,
      conditions: dogConditions,
      medications: dogMeds,
      novelties,
      alerts,
      inTreatment: dogMeds.length > 0 || dogConditions.some((c) => c.status === "active" || c.status === "chronic"),
    };
  });

  events.sort((a, b) => a.date.localeCompare(b.date) || a.dogName.localeCompare(b.dogName, "es"));
  const names = new Map(dogs.map((d) => [d.id, d.name]));
  const recentConsults = raw.consultations
    .filter((c) => names.has(c.dog_id) && c.record_date <= todayStr)
    .sort((a, b) => b.record_date.localeCompare(a.record_date))
    .slice(0, 10)
    .map((c) => ({
      id: c.id, dogId: c.dog_id, dogName: names.get(c.dog_id)!, date: c.record_date, type: c.record_type,
      reason: c.reason, diagnosis: c.diagnosis, veterinarian: c.veterinarian,
    }));
  return { dogs: out, events, recentConsults };
}

// ── Segmentos y resumen ──────────────────────────────────────────────────────

export type ClinicSegment = "all" | "attention" | "treatment" | "special" | "vaccines" | "deworming" | "controls";

export const CLINIC_SEGMENT_LABELS: Record<ClinicSegment, string> = {
  all: "Todos",
  attention: "Con novedad",
  treatment: "En tratamiento",
  special: "Cuidados especiales",
  vaccines: "Vacunas vencidas",
  deworming: "Desparasitación vencida",
  controls: "Controles pendientes",
};

/** Algo que requiere acción (urgente o pendiente), no solo seguimiento. */
export const needsClinicalAttention = (d: ClinicDog) => d.alerts.some((a) => a.severity <= 1);

export function matchesSegment(d: ClinicDog, s: ClinicSegment): boolean {
  switch (s) {
    case "attention": return needsClinicalAttention(d);
    case "treatment": return d.inTreatment;
    case "special": return hasSpecialCare(d.flags);
    case "vaccines": return d.vaccines.some((v) => v.state === "overdue");
    case "deworming": return d.deworming?.state === "overdue";
    case "controls": return !!d.nextControl;
    default: return true;
  }
}

export interface ClinicSummary {
  total: number;
  attention: number;
  treatment: number;
  vaccinesOverdue: number;
  vaccinesUpToDate: number;
  dewormingOverdue: number;
  dewormedRecently: number;
  controlsPending: number;
  upcoming: number;
  /** Misma cifra que "Cuidados especiales" del Panel de perros. */
  special: SpecialCareSummary;
}

export function summarize(dogs: ClinicDog[], events: ClinicEvent[], horizonDays = DUE_SOON_DAYS, today = new Date()): ClinicSummary {
  const limit = iso(addDays(today, horizonDays));
  const todayStr = iso(today);
  return {
    total: dogs.length,
    attention: dogs.filter(needsClinicalAttention).length,
    treatment: dogs.filter((d) => d.inTreatment).length,
    vaccinesOverdue: dogs.filter((d) => d.vaccines.some((v) => v.state === "overdue")).length,
    vaccinesUpToDate: dogs.filter((d) => d.vaccines.length > 0 && d.vaccines.every((v) => v.state !== "overdue")).length,
    dewormingOverdue: dogs.filter((d) => d.deworming?.state === "overdue").length,
    dewormedRecently: dogs.filter((d) => d.deworming && d.deworming.state !== "overdue").length,
    controlsPending: dogs.filter((d) => d.nextControl).length,
    upcoming: events.filter((e) => e.date >= todayStr && e.date <= limit).length,
    special: summarizeSpecialCare(dogs.map((d) => d.flags)),
  };
}

/** Texto relativo para la agenda: "Hoy", "Mañana", "En 5 días", "Hace 3 días". */
export function relativeDay(date: string, today = new Date()): string {
  const d = differenceInCalendarDays(parseDateOnly(date), today);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return d > 0 ? `En ${d} días` : `Hace ${-d} días`;
}
