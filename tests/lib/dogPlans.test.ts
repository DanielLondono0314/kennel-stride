import { describe, it, expect } from "vitest";
import {
  checkoutUnits, computeEndDate, currentPlan, planProgressPct, planProgressText, planReminderMessage, planState,
  plansCoveringReservation, reminderDue, type DogPlan,
} from "@/lib/dogPlans";

const today = new Date(2026, 8, 30); // 30 sep 2026

const plan = (p: Partial<DogPlan>): DogPlan => ({
  id: "1", dog_id: "d", customer_id: null, service_type: "x", service_label: "X", category: null,
  billing: "duration", start_date: "2026-09-02", end_date: "2026-10-31", quantity_total: null, quantity_used: 0,
  unit_label: null, consumption: null, price: 0, includes: [], conditions: "", notes: null,
  status: "active", ended_at: null, created_at: "2026-09-02", sold_on: "2026-09-02", ...p,
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

describe("planes en el check-out", () => {
  const perDay = plan({ billing: "quantity", end_date: null, quantity_total: 5, quantity_used: 3, unit_label: "días", consumption: "per_day", service_type: "daycare", category: "daycare" });
  const perVisit = plan({ id: "2", billing: "quantity", end_date: null, quantity_total: 10, quantity_used: 0, unit_label: "clases", consumption: "per_visit", service_type: "clases", category: "training" });

  it("unidades: por día cuenta desde el check-in; por visita, 1; por duración, 0", () => {
    expect(checkoutUnits(perDay, new Date(2026, 8, 28, 9), today)).toBe(3);
    expect(checkoutUnits(perDay, new Date(2026, 8, 30, 7), today)).toBe(1);
    expect(checkoutUnits(perVisit, new Date(2026, 8, 25), today)).toBe(1);
    expect(checkoutUnits(plan({}), new Date(2026, 8, 25), today)).toBe(0);
  });

  it("cubre por servicio o por categoría, y avisa si no alcanza", () => {
    const boarding = plan({ id: "3", service_type: "internado_2m", category: "boarding" });
    const res = { serviceType: "board_and_train", category: "boarding", startDate: new Date(2026, 8, 29), checkIn: new Date(2026, 8, 29) };
    expect(plansCoveringReservation([perDay, perVisit, boarding], res, today).map((c) => c.plan.id)).toEqual(["3"]);

    const daycare = { serviceType: "daycare", category: "daycare", startDate: new Date(2026, 8, 27), checkIn: new Date(2026, 8, 27) };
    const [c] = plansCoveringReservation([perDay], daycare, today);
    expect(c.units).toBe(4);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe("Solo le quedan 2 días y esta estadía usa 4");
  });

  it("no cubre con planes vencidos antes de la reserva, por iniciar o finalizados", () => {
    const res = { serviceType: "x", category: null, startDate: new Date(2026, 8, 30), checkIn: new Date(2026, 8, 30) };
    expect(plansCoveringReservation([plan({ end_date: "2026-09-29" })], res, today)).toHaveLength(0);
    expect(plansCoveringReservation([plan({ start_date: "2026-10-02" })], res, today)).toHaveLength(0);
    expect(plansCoveringReservation([plan({ status: "finished" })], res, today)).toHaveLength(0);
    expect(plansCoveringReservation([plan({})], res, today)).toHaveLength(1);
  });

  it("mensaje de WhatsApp para renovar", () => {
    expect(planReminderMessage(plan({ end_date: "2026-10-03" }), "Kaelis", "Dani", today))
      .toBe("Hola Dani, te contamos que el plan X de Kaelis vence el 3 de octubre. ¿Quieres renovarlo?");
    expect(planReminderMessage(perDay, "Kaelis", null, today))
      .toBe("Hola, te contamos que al plan X de Kaelis le quedan 2 días. ¿Quieres renovarlo?");
  });
});

describe("recordatorios al dueño", () => {
  const q = { billing: "quantity" as const, end_date: null, quantity_total: 10, unit_label: "clases" };
  it("una vez por situación: por vencer, agotado, vencido reciente", () => {
    expect(reminderDue(plan({}), today)).toBeNull(); // vigente
    expect(reminderDue(plan({ end_date: "2026-10-04" }), today)).toBe("expiring");
    expect(reminderDue(plan({ end_date: "2026-10-04", reminded_state: "expiring" }), today)).toBeNull();
    expect(reminderDue(plan({ ...q, quantity_used: 10, reminded_state: "expiring" }), today)).toBe("depleted");
    expect(reminderDue(plan({ end_date: "2026-09-27" }), today)).toBe("expired");
    expect(reminderDue(plan({ end_date: "2026-09-01" }), today)).toBeNull(); // venció hace mucho
    expect(reminderDue(plan({ end_date: "2026-10-04", status: "finished" }), today)).toBeNull();
  });
});

