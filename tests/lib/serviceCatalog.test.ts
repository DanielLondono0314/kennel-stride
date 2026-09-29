import { describe, it, expect } from "vitest";
import "@/lib/zodEs";
import { billingSummary, catalogServiceSchema, normalizeService, serializeService, slugify } from "@/lib/serviceCatalog";

describe("catálogo de servicios", () => {
  it("un servicio guardado antes (solo value/label) se lee como 'por uso' y activo", () => {
    const s = normalizeService({ value: "daycare", label: "Guardería" });
    expect(s).toMatchObject({ billing: "per_use", duration: null, quantity: null, price: null, includes: [], conditions: "", active: true });
  });

  it("resume la modalidad", () => {
    expect(billingSummary(normalizeService({ value: "x", label: "X", billing: "duration", duration: { amount: 2, unit: "months" } }))).toBe("2 meses");
    expect(billingSummary(normalizeService({ value: "x", label: "X", billing: "duration", duration: { amount: 1, unit: "weeks" } }))).toBe("1 semana");
    expect(billingSummary(normalizeService({ value: "x", label: "X", billing: "quantity", quantity: { amount: 10, unitLabel: "clases" } }))).toBe("10 clases");
  });

  it("al guardar descarta los datos que no aplican a la modalidad", () => {
    const s = normalizeService({
      value: "x", label: "X", billing: "per_use",
      duration: { amount: 2, unit: "months" }, quantity: { amount: 5, unitLabel: "días" },
    });
    expect(serializeService(s)).toMatchObject({ duration: null, quantity: null });
  });

  it("exige la duración o la cantidad según la modalidad", () => {
    const base = normalizeService({ value: "x", label: "X" });
    expect(catalogServiceSchema.safeParse({ ...base, billing: "duration", duration: null }).success).toBe(false);
    expect(catalogServiceSchema.safeParse({ ...base, billing: "quantity", quantity: { amount: 10, unitLabel: "clases", consumption: "per_visit" } }).success).toBe(true);
  });

  it("genera el identificador desde el nombre", () => {
    expect(slugify("Internado + Entrenamiento")).toBe("internado_entrenamiento");
    expect(slugify("Baño y peluquería")).toBe("bano_y_peluqueria");
  });
});
