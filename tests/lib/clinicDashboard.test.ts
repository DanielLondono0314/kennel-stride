import { describe, it, expect } from "vitest";
import { buildClinicDashboard, matchesSegment, summarize, relativeDay, type ClinicDogBase, type ClinicRaw } from "@/lib/clinicDashboard";

const today = new Date(2026, 9, 2); // 2 oct 2026

const dog = (id: string, p: Partial<ClinicDogBase> = {}): ClinicDogBase => ({
  id, name: id.toUpperCase(), breed: "Criollo", photoUrl: null, owner: null, inCenter: false,
  weightStatus: "stable", weightChangePct: null, allergies: [], ...p,
});

const empty: ClinicRaw = { consultations: [], vaccines: [], dewormings: [], conditions: [], medications: [], welfare: [] };
const consult = (p: Partial<ClinicRaw["consultations"][number]>) => ({
  id: Math.random().toString(), dog_id: "a", record_date: "2026-09-01", record_type: "consultation",
  reason: "Consulta", diagnosis: null, veterinarian: "Dra. Ana", next_appointment: null, ...p,
});

describe("panel de clínica", () => {
  it("vacunas: la última dosis manda; sin próxima fecha se estima anual", () => {
    const { dogs, events } = buildClinicDashboard([dog("a")], {
      ...empty,
      vaccines: [
        { dog_id: "a", vaccine_name: "Rabia", date_administered: "2024-09-01", next_dose_date: "2025-09-01" },
        { dog_id: "a", vaccine_name: "rabia", date_administered: "2025-10-10", next_dose_date: null },
        { dog_id: "a", vaccine_name: "Moquillo", date_administered: "2025-06-01", next_dose_date: "2026-06-01" },
      ],
    }, today);
    const v = dogs[0].vaccines;
    expect(v.map((x) => [x.name, x.nextDate, x.state, x.estimated])).toEqual([
      ["Moquillo", "2026-06-01", "overdue", false],
      ["rabia", "2026-10-10", "due_soon", true],
    ]);
    expect(dogs[0].alerts[0]).toEqual({ kind: "vaccine_overdue", severity: 0, label: "Vacuna vencida: Moquillo" });
    expect(events.filter((e) => e.type === "vaccine")).toHaveLength(2);
  });

  it("desparasitación sin próxima dosis: se estima a 3 meses", () => {
    const { dogs } = buildClinicDashboard([dog("a")], {
      ...empty,
      dewormings: [{ dog_id: "a", product_name: "Fenbendazol", product_type: "internal", date_administered: "2026-06-15", next_dose_date: null }],
    }, today);
    expect(dogs[0].deworming).toMatchObject({ nextDate: "2026-09-13", estimated: true, state: "overdue", daysLeft: -19 });
    expect(dogs[0].alerts.map((a) => a.label)).toContain("Desparasitación vencida hace 19 días (estimada)");
  });

  it("controles: pendiente si no hubo consulta después; los muy viejos no alertan", () => {
    const pending = buildClinicDashboard([dog("a")], { ...empty, consultations: [consult({ record_date: "2026-09-20", next_appointment: "2026-09-27" })] }, today);
    expect(pending.dogs[0].nextControl).toEqual({ date: "2026-09-27", overdue: true });
    expect(pending.dogs[0].alerts.map((a) => a.label)).toContain("Control vencido hace 5 días");

    const done = buildClinicDashboard([dog("a")], {
      ...empty,
      consultations: [consult({ record_date: "2026-09-20", next_appointment: "2026-09-27" }), consult({ record_date: "2026-09-28", record_type: "checkup" })],
    }, today);
    expect(done.dogs[0].nextControl).toBeNull();

    const stale = buildClinicDashboard([dog("a")], { ...empty, consultations: [consult({ record_date: "2026-02-01", next_appointment: "2026-02-15" })] }, today);
    expect(stale.dogs[0].nextControl).toBeNull();
  });

  it("en tratamiento: medicación vigente o condición activa/crónica; severa es urgente", () => {
    const { dogs, events } = buildClinicDashboard([dog("a"), dog("b"), dog("c")], {
      ...empty,
      medications: [
        { dog_id: "a", name: "Apoquel", dose: "16 mg", frequency: "cada 12 h", start_date: "2026-09-01", end_date: "2026-10-15" },
        { dog_id: "b", name: "Viejo", dose: null, frequency: null, start_date: "2026-01-01", end_date: "2026-02-01" },
      ],
      conditions: [{ dog_id: "c", condition_name: "Displasia", status: "chronic", severity: "severe", treatment: null, diagnosed_date: "2025-01-01" }],
    }, today);
    expect(dogs.map((d) => d.inTreatment)).toEqual([true, false, true]);
    expect(dogs[2].alerts[0]).toMatchObject({ kind: "condition_severe", severity: 0 });
    expect(events).toEqual([expect.objectContaining({ type: "treatment_end", date: "2026-10-15", label: "Apoquel" })]);
  });

  it("novedades de ronda recientes y pérdida de peso", () => {
    const { dogs } = buildClinicDashboard([dog("a", { weightStatus: "loss", weightChangePct: -6.2 })], {
      ...empty,
      welfare: [
        { dog_id: "a", checked_at: "2026-10-01T14:00:00Z", flags: ["Lesión"], notes: "Raspón pata" },
        { dog_id: "a", checked_at: "2026-09-01T14:00:00Z", flags: ["Pelea"], notes: null },
      ],
    }, today);
    expect(dogs[0].novelties).toHaveLength(1);
    expect(dogs[0].alerts.map((a) => a.label)).toEqual(["Novedad en ronda: Lesión", "Pérdida de peso (-6.2%)", "Sin vacunas registradas"]);
  });

  it("segmentos y resumen", () => {
    const { dogs, events } = buildClinicDashboard([dog("a"), dog("b")], {
      ...empty,
      vaccines: [{ dog_id: "a", vaccine_name: "Rabia", date_administered: "2026-01-01", next_dose_date: "2026-10-20" }],
      dewormings: [{ dog_id: "b", product_name: "X", product_type: "internal", date_administered: "2026-01-01", next_dose_date: "2026-03-01" }],
    }, today);
    expect(dogs.filter((d) => matchesSegment(d, "deworming")).map((d) => d.id)).toEqual(["b"]);
    expect(summarize(dogs, events, 30, today)).toMatchObject({ total: 2, vaccinesUpToDate: 1, dewormingOverdue: 1, upcoming: 1 });
  });

  it("fechas relativas", () => {
    expect(relativeDay("2026-10-02", today)).toBe("Hoy");
    expect(relativeDay("2026-10-03", today)).toBe("Mañana");
    expect(relativeDay("2026-09-28", today)).toBe("Hace 4 días");
  });
});
