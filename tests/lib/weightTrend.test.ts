import { describe, it, expect } from "vitest";
import { analyzeWeight, normalizeWeightPoints, formatSignedKg, formatSignedPct } from "@/lib/weightTrend";
import { parseDogDashboardConfig, DEFAULT_DOG_DASHBOARD_CONFIG } from "@/lib/dogDashboardConfig";

const settings = { checkIntervalDays: 14, alertPct: 5, windowDays: 30 };
const today = new Date(2026, 8, 25); // 25 sep 2026, local

describe("normalizeWeightPoints", () => {
  it("ordena por fecha y promedia pesadas del mismo día", () => {
    const out = normalizeWeightPoints([
      { date: "2026-09-10", weight: 20 },
      { date: "2026-09-01", weight: 21 },
      { date: "2026-09-10", weight: 21 },
    ]);
    expect(out).toEqual([
      { date: "2026-09-01", weight: 21 },
      { date: "2026-09-10", weight: 20.5 },
    ]);
  });

  it("descarta pesos inválidos", () => {
    expect(normalizeWeightPoints([{ date: "2026-09-01", weight: 0 }, { date: "2026-09-02", weight: NaN }])).toEqual([]);
  });
});

describe("analyzeWeight", () => {
  it("sin datos: no_data y pesaje vencido", () => {
    const a = analyzeWeight([], settings, today);
    expect(a.status).toBe("no_data");
    expect(a.isOverdue).toBe(true);
    expect(a.latest).toBeNull();
  });

  it("una sola fecha: single, sin variación", () => {
    const a = analyzeWeight([{ date: "2026-09-20", weight: 18 }], settings, today);
    expect(a.status).toBe("single");
    expect(a.changePct).toBeNull();
    expect(a.daysSinceLast).toBe(5);
    expect(a.isOverdue).toBe(false);
  });

  it("detecta pérdida de peso sobre el umbral", () => {
    const a = analyzeWeight([
      { date: "2026-08-20", weight: 20 },
      { date: "2026-09-24", weight: 18.8 },
    ], settings, today);
    expect(a.status).toBe("loss");
    expect(a.changeKg).toBe(-1.2);
    expect(a.changePct).toBe(-6);
  });

  it("detecta aumento de peso sobre el umbral", () => {
    const a = analyzeWeight([
      { date: "2026-08-20", weight: 10 },
      { date: "2026-09-24", weight: 10.6 },
    ], settings, today);
    expect(a.status).toBe("gain");
  });

  it("dentro del umbral es estable", () => {
    const a = analyzeWeight([
      { date: "2026-08-20", weight: 20 },
      { date: "2026-09-24", weight: 19.5 },
    ], settings, today);
    expect(a.status).toBe("stable");
    expect(a.changePct).toBe(-2.5);
  });

  it("usa como baseline la pesada más reciente con al menos windowDays de antigüedad", () => {
    const a = analyzeWeight([
      { date: "2026-06-01", weight: 30 }, // demasiado vieja: no es la baseline
      { date: "2026-08-20", weight: 20 },  // ≥30 días antes de la última → baseline
      { date: "2026-09-10", weight: 19 },  // <30 días → no
      { date: "2026-09-24", weight: 20.2 },
    ], settings, today);
    expect(a.baseline?.date).toBe("2026-08-20");
    expect(a.status).toBe("stable");
  });

  it("historial corto: compara contra la primera pesada (pérdida rápida alerta)", () => {
    const a = analyzeWeight([
      { date: "2026-09-14", weight: 20 },
      { date: "2026-09-24", weight: 18.5 },
    ], settings, today);
    expect(a.baseline?.date).toBe("2026-09-14");
    expect(a.status).toBe("loss");
    expect(a.kgPerWeek).toBeCloseTo(-1.05, 2);
  });

  it("marca pesaje vencido cuando pasa el intervalo", () => {
    const a = analyzeWeight([{ date: "2026-09-01", weight: 12 }], settings, today);
    expect(a.daysSinceLast).toBe(24);
    expect(a.isOverdue).toBe(true);
  });
});

describe("formatos con signo", () => {
  it("usa signo menos tipográfico", () => {
    expect(formatSignedKg(-1.25)).toBe("−1,3 kg");
    expect(formatSignedKg(0.5)).toBe("+0,5 kg");
    expect(formatSignedPct(-6)).toBe("−6%");
  });
});

describe("parseDogDashboardConfig", () => {
  it("vacío → defaults", () => {
    expect(parseDogDashboardConfig({})).toEqual(DEFAULT_DOG_DASHBOARD_CONFIG);
    expect(parseDogDashboardConfig(null)).toEqual(DEFAULT_DOG_DASHBOARD_CONFIG);
  });

  it("mezcla lo guardado con los defaults e ignora claves desconocidas", () => {
    const c = parseDogDashboardConfig({
      weight: { alertPct: 8 },
      sections: { feedingMix: false, bogus: true },
      cardFields: { owner: false },
    });
    expect(c.weight).toEqual({ ...DEFAULT_DOG_DASHBOARD_CONFIG.weight, alertPct: 8 });
    expect(c.sections.feedingMix).toBe(false);
    expect(c.sections.kpis).toBe(true);
    expect("bogus" in c.sections).toBe(false);
    expect(c.cardFields.owner).toBe(false);
  });

  it("umbrales fuera de rango caen a defaults", () => {
    const c = parseDogDashboardConfig({ weight: { alertPct: 500 } });
    expect(c.weight).toEqual(DEFAULT_DOG_DASHBOARD_CONFIG.weight);
  });
});
