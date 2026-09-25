import { describe, it, expect } from "vitest";
import { applyFilters, attentionReasons, needsAttention, type DashboardFilters } from "@/components/dog-dashboard/model";
import type { DashboardDog } from "@/hooks/queries/useDogDashboard";
import { analyzeWeight } from "@/lib/weightTrend";

const today = new Date(2026, 8, 25);
const settings = { checkIntervalDays: 14, alertPct: 5, windowDays: 30 };

function dog(overrides: Partial<DashboardDog> & { name: string }): DashboardDog {
  return {
    id: overrides.name,
    breed: "Mestizo",
    age: "3 años",
    gender: "male",
    isNeutered: true,
    photoUrl: null,
    owner: { id: "c1", name: "Ana Pérez", phone: null },
    flags: { aggressive: false, allergies: false, medication: false },
    aggression: null,
    behaviorNotes: null,
    feeding: { foodType: "seco", brand: null, mealsPerDay: 2, portion: null, instructions: null },
    weight: analyzeWeight([{ date: "2026-09-20", weight: 20 }], settings, today),
    plan: { state: "active", name: "Bono 10", serviceType: "daycare", remaining: 8, total: 10, expiresAt: "2026-12-01", daysLeft: 67, extraCount: 0 },
    stay: { state: "none", serviceName: null, startDate: null, endDate: null },
    kennel: null,
    allergies: [],
    medications: [],
    vaccines: { overdue: [], dueSoon: [], nextDate: null },
    lastReport: null,
    ...overrides,
  };
}

const base: DashboardFilters = { search: "", segment: "all", weightStatus: "", planState: "", foodType: "", sort: "name" };

const losing = dog({
  name: "Toby",
  weight: analyzeWeight([{ date: "2026-08-20", weight: 20 }, { date: "2026-09-24", weight: 18 }], settings, today),
});
const neverWeighed = dog({ name: "Luna", weight: analyzeWeight([], settings, today), plan: { ...dog({ name: "x" }).plan, state: "none", name: null } });
const inCenter = dog({ name: "Ñoño", stay: { state: "in_center", serviceName: "Guardería", startDate: null, endDate: null }, feeding: null });
const all = [losing, neverWeighed, inCenter];

describe("attentionReasons", () => {
  it("prioriza la pérdida de peso como crítica", () => {
    const r = attentionReasons(losing);
    expect(r[0].kind).toBe("weight_loss");
    expect(r[0].severity).toBe(0);
    expect(needsAttention(losing)).toBe(true);
  });

  it("nunca pesado no cuenta como alerta de salud, pero sí como pendiente", () => {
    expect(attentionReasons(neverWeighed).map((r) => r.kind)).toContain("weigh_in_overdue");
    expect(needsAttention(neverWeighed)).toBe(false);
  });
});

describe("applyFilters", () => {
  it("busca sin distinguir acentos, por nombre o dueño", () => {
    expect(applyFilters(all, { ...base, search: "nono" }).map((d) => d.name)).toEqual(["Ñoño"]);
    expect(applyFilters(all, { ...base, search: "perez" })).toHaveLength(3);
  });

  it("filtra por segmento", () => {
    expect(applyFilters(all, { ...base, segment: "in_center" }).map((d) => d.name)).toEqual(["Ñoño"]);
    expect(applyFilters(all, { ...base, segment: "attention" }).map((d) => d.name)).toEqual(["Toby"]);
    expect(applyFilters(all, { ...base, segment: "overdue" }).map((d) => d.name)).toEqual(["Luna"]);
    expect(applyFilters(all, { ...base, segment: "no_plan" }).map((d) => d.name)).toEqual(["Luna"]);
  });

  it("filtra por alimentación, incluyendo 'sin registrar'", () => {
    expect(applyFilters(all, { ...base, foodType: "sin_dato" }).map((d) => d.name)).toEqual(["Ñoño"]);
  });

  it("ordena por mayor variación de peso, sin datos al final", () => {
    const out = applyFilters(all, { ...base, sort: "weight_change" }).map((d) => d.name);
    expect(out[0]).toBe("Toby");
  });

  it("ordena por pesaje más antiguo con los nunca pesados primero", () => {
    expect(applyFilters(all, { ...base, sort: "last_weigh_in" })[0].name).toBe("Luna");
  });
});
