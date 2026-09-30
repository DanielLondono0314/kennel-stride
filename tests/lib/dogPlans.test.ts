import { describe, it, expect } from "vitest";
import { computeEndDate, currentPlan, planProgressPct, planProgressText, planState, type DogPlan } from "@/lib/dogPlans";

const today = new Date(2026, 8, 30); // 30 sep 2026

const plan = (p: Partial<DogPlan>): DogPlan => ({
  id: "1", dog_id: "d", customer_id: null, service_type: "x", service_label: "X", category: null,
  billing: "duration", start_date: "2026-09-02", end_date: "2026-10-31", quantity_total: null, quantity_used: 0,
  unit_label: null, consumption: null, price: 0, includes: [], conditions: "", notes: null,
  status: "active", ended_at: null, created_at: "2026-09-02", ...p,
});

describe("planes de perros", () => {
  it("fecha de fin: inicio + duración − 1 día", () => {
    expect(computeEndDate("2026-09-02", 2, "months")).toBe("2026-11-01");
    expect(computeEndDate("2026-09-30", 1, "weeks")).toBe("2026-10-06");
    expect(computeEndDate("2026-09-30", 1, "days")).toBe("2026-09-30");
  });

  it("estado por fechas", () => {
    expect(planState(plan({}), today)).toBe("active");
    expect(planState(plan({ end_date: "2026-10-04" }), today)).toBe("expiring");
    expect(planState(plan({ end_date: "2026-09-29" }), today)).toBe("expired");
    expect(planState(plan({ start_date: "2026-10-05" }), today)).toBe("upcoming");
    expect(planState(plan({ status: "finished" }), today)).toBe("finished");
  });

  it("estado por cantidad", () => {
    const q = { billing: "quantity" as const, end_date: null, quantity_total: 10, unit_label: "clases" };
    expect(planState(plan({ ...q, quantity_used: 4 }), today)).toBe("active");
    expect(planState(plan({ ...q, quantity_used: 8 }), today)).toBe("expiring");
    expect(planState(plan({ ...q, quantity_used: 10 }), today)).toBe("depleted");
    expect(planProgressText(plan({ ...q, quantity_used: 4 }), today)).toBe("Quedan 6 de 10 clases");
    expect(planProgressPct(plan({ ...q, quantity_used: 4 }), today)).toBe(40);
  });

  it("texto de vigencia", () => {
    expect(planProgressText(plan({}), today)).toBe("Vigente hasta 31 oct 2026");
    expect(planProgressText(plan({ end_date: "2026-09-30" }), today)).toBe("Vence hoy");
  });

  it("plan actual: el vigente que vence antes, sin contar los terminados", () => {
    const a = plan({ id: "a", end_date: "2026-12-31" });
    const b = plan({ id: "b", end_date: "2026-10-31" });
    const c = plan({ id: "c", status: "finished" });
    expect(currentPlan([a, b, c], today)?.id).toBe("b");
    expect(currentPlan([c], today)).toBeNull();
  });
});
