import { describe, it, expect } from "vitest";
import {
  buildReportCardPayload,
  categoryOf,
  inferCategory,
  readMetrics,
} from "@/lib/reportCardServices";

describe("inferCategory", () => {
  it.each([
    ["grooming", "Grooming", "grooming"],
    ["spa_canino", "Spa canino", "grooming"],
    ["bano", "Baño y corte", "grooming"],
    ["consulta", "Consulta veterinaria", "vet"],
    ["training_session", "Sesión de Entrenamiento", "training"],
    ["board_and_train", "Internado + Entrenamiento", "training"],
    ["daycare", "Guardería", "stay"],
    ["hotel", "Hotel canino", "stay"],
    ["paseo", "Paseo grupal", "walk"],
    ["evaluation", "Evaluación", "evaluation"],
    ["fiesta", "Fiesta de cumpleaños", "general"],
  ])("%s / %s → %s", (value, label, expected) => {
    expect(inferCategory(value, label)).toBe(expected);
  });
});

describe("categoryOf", () => {
  it("respeta la categoría configurada en Ajustes", () => {
    expect(categoryOf({ value: "premium", label: "Plan premium", category: "grooming" })).toBe("grooming");
  });

  it("ignora una categoría inválida e infiere del nombre", () => {
    expect(categoryOf({ value: "paseo", label: "Paseo", category: "nope" })).toBe("walk");
  });

  it("usa el service_type cuando el servicio ya no existe en la org", () => {
    expect(categoryOf(undefined, "grooming")).toBe("grooming");
  });
});

describe("buildReportCardPayload", () => {
  it("deja en NULL las métricas clásicas que no aplican al servicio", () => {
    const { columns, details } = buildReportCardPayload({
      category: "grooming",
      serviceLabel: "Spa",
      overall: 5,
      ratings: { behavior: 4, obedience: 2 },
      values: { services_done: ["Baño", "Corte de uñas"], products: "  " },
    });
    expect(columns).toEqual({ energy_level: null, socialization: null, obedience: null, appetite: null });
    expect(details.ratings).toEqual({ behavior: 4 });
    expect(details.metrics).toEqual([
      { label: "Puntuación general", value: 5 },
      { label: "Comportamiento durante el servicio", value: 4 },
    ]);
    // Los vacíos no se guardan
    expect(details.values).toEqual({ services_done: ["Baño", "Corte de uñas"] });
    expect(details.summary).toEqual([{ label: "Servicios realizados", value: "Baño, Corte de uñas" }]);
    expect(details.staff_label).toBe("Groomer");
    expect(details.service_label).toBe("Spa");
  });

  it("formatea unidades y fechas en el resumen", () => {
    const { columns, details } = buildReportCardPayload({
      category: "vet",
      serviceLabel: "Consulta",
      overall: 4,
      ratings: {},
      values: { weight_kg: 12.5, next_checkup: "2026-10-15", reason: "Control" },
    });
    expect(columns.energy_level).toBeNull();
    expect(details.summary).toEqual([
      { label: "Motivo de consulta", value: "Control" },
      { label: "Peso", value: "12.5 kg" },
      { label: "Próximo control", value: "15/10/2026" },
    ]);
  });

  it("guarda las métricas de entrenamiento en columnas y en ratings", () => {
    const { columns, details } = buildReportCardPayload({
      category: "training",
      serviceLabel: "Entrenamiento",
      overall: 3,
      ratings: { obedience: 5, focus: 4 },
      values: {},
    });
    expect(columns.obedience).toBe(5);
    expect(columns.socialization).toBe(3); // default cuando no se tocó
    expect(columns.appetite).toBeNull();
    expect(details.ratings).toEqual({ focus: 4 });
  });
});

describe("readMetrics", () => {
  it("usa details.metrics cuando existe", () => {
    expect(
      readMetrics({
        overall_score: 4, energy_level: null, socialization: null, obedience: null, appetite: null,
        details: { metrics: [{ label: "X", value: 2 }] },
      })
    ).toEqual([{ label: "X", value: 2 }]);
  });

  it("cae a las columnas clásicas en report cards antiguos, omitiendo NULL", () => {
    expect(
      readMetrics({ overall_score: 4, energy_level: 3, socialization: null, obedience: 5, appetite: null, details: {} })
    ).toEqual([
      { label: "Puntuación general", value: 4 },
      { label: "Energía", value: 3 },
      { label: "Obediencia", value: 5 },
    ]);
  });
});
