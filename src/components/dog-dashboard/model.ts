import type { DashboardDog, PlanState } from "@/hooks/queries/useDogDashboard";
import type { WeightStatus } from "@/lib/weightTrend";

// Etiquetas y filtros del Panel de perros (lógica pura, testeable).

export const FOOD_TYPE_LABELS: Record<string, string> = {
  seco: "Seco", humedo: "Húmedo", crudo: "Crudo", mixto: "Mixto",
};

export const SERVICE_LABELS: Record<string, string> = {
  daycare: "Guardería", board_and_train: "Internado", training_session: "Entrenamiento",
  grooming: "Grooming", evaluation: "Evaluación", boarding: "Hospedaje",
};

export const PLAN_STATE_LABELS: Record<PlanState, string> = {
  active: "Plan vigente",
  expiring: "Por vencer",
  none: "Sin plan activo",
};

export const SEVERITY_LABELS: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };

export type Segment = "all" | "in_center" | "attention" | "overdue" | "no_plan";

export const SEGMENT_LABELS: Record<Segment, string> = {
  all: "Todos",
  in_center: "En el centro",
  attention: "Requieren atención",
  overdue: "Pesaje vencido",
  no_plan: "Sin plan",
};

export type SortKey = "name" | "weight_change" | "last_weigh_in" | "plan_expiry";

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Nombre",
  weight_change: "Mayor variación de peso",
  last_weigh_in: "Pesaje más antiguo",
  plan_expiry: "Plan que vence antes",
};

export interface DashboardFilters {
  search: string;
  segment: Segment;
  weightStatus: WeightStatus | "";
  planState: PlanState | "";
  foodType: string;
  sort: SortKey;
}

/** Motivos por los que un perro necesita atención, del más al menos grave. */
export interface AttentionReason {
  kind: "weight_loss" | "weight_gain" | "vaccine_overdue" | "weigh_in_overdue" | "plan_expiring";
  severity: 0 | 1 | 2; // 0 = crítico
  label: string;
}

export function attentionReasons(dog: DashboardDog): AttentionReason[] {
  const out: AttentionReason[] = [];
  const w = dog.weight;
  if (w.status === "loss" && w.changePct !== null) {
    out.push({ kind: "weight_loss", severity: 0, label: `Bajó ${Math.abs(w.changePct).toLocaleString("es")}% de peso` });
  }
  if (w.status === "gain" && w.changePct !== null) {
    out.push({ kind: "weight_gain", severity: 1, label: `Subió ${w.changePct.toLocaleString("es")}% de peso` });
  }
  if (dog.vaccines.overdue.length) {
    out.push({ kind: "vaccine_overdue", severity: 1, label: `Vacuna vencida: ${dog.vaccines.overdue.join(", ")}` });
  }
  if (w.isOverdue) {
    out.push({
      kind: "weigh_in_overdue",
      severity: 2,
      label: w.daysSinceLast === null ? "Nunca se ha pesado" : `Sin pesar hace ${w.daysSinceLast} días`,
    });
  }
  if (dog.plan.state === "expiring") {
    const d = dog.plan.daysLeft;
    out.push({
      kind: "plan_expiring",
      severity: 2,
      label: d !== null && d <= 7 ? `Plan vence en ${d} día${d === 1 ? "" : "s"}` : `Quedan ${dog.plan.remaining} crédito${dog.plan.remaining === 1 ? "" : "s"}`,
    });
  }
  return out.sort((a, b) => a.severity - b.severity);
}

/** "Requiere atención" = algo clínico o de peso (no solo un plan por vencer). */
export function needsAttention(dog: DashboardDog): boolean {
  return attentionReasons(dog).some((r) => r.kind !== "plan_expiring" && r.kind !== "weigh_in_overdue");
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function applyFilters(dogs: DashboardDog[], f: DashboardFilters): DashboardDog[] {
  const q = normalize(f.search.trim());
  const filtered = dogs.filter((d) => {
    if (q && !normalize(`${d.name} ${d.breed} ${d.owner?.name ?? ""} ${d.kennel ?? ""}`).includes(q)) return false;
    switch (f.segment) {
      case "in_center": if (d.stay.state !== "in_center") return false; break;
      case "attention": if (!needsAttention(d)) return false; break;
      case "overdue": if (!d.weight.isOverdue) return false; break;
      case "no_plan": if (d.plan.state !== "none") return false; break;
    }
    if (f.weightStatus && d.weight.status !== f.weightStatus) return false;
    if (f.planState && d.plan.state !== f.planState) return false;
    if (f.foodType && (d.feeding?.foodType ?? "sin_dato") !== f.foodType) return false;
    return true;
  });

  const byName = (a: DashboardDog, b: DashboardDog) => a.name.localeCompare(b.name, "es");
  const sorters: Record<SortKey, (a: DashboardDog, b: DashboardDog) => number> = {
    name: byName,
    weight_change: (a, b) =>
      Math.abs(b.weight.changePct ?? -1) - Math.abs(a.weight.changePct ?? -1) || byName(a, b),
    last_weigh_in: (a, b) =>
      (b.weight.daysSinceLast ?? Infinity) - (a.weight.daysSinceLast ?? Infinity) || byName(a, b),
    plan_expiry: (a, b) => (a.plan.daysLeft ?? Infinity) - (b.plan.daysLeft ?? Infinity) || byName(a, b),
  };
  return filtered.sort(sorters[f.sort]);
}
