import { describe, it, expect } from "vitest";
import { feedingSummary, readAggression, readFeeding } from "@/lib/dogCare";

describe("dogCare", () => {
  it("resume la alimentación", () => {
    const f = readFeeding({ food_type: "seco", meals_per_day: 2, portion_amount: 150, portion_unit: "g", brand: "", instructions: "" });
    expect(feedingSummary(f)).toBe("Seco · 2 comidas/día · 150 g");
  });

  it("tolera porciones vacías y JSON inválido", () => {
    expect(readFeeding({ food_type: "humedo", portion_amount: "", portion_unit: "" })?.portion).toBeNull();
    expect(readFeeding(null)).toBeNull();
    expect(readFeeding({ food_type: "", brand: "" })).toBeNull();
  });

  it("lee las indicaciones de agresividad", () => {
    expect(readAggression({ severity: "alta", handling: "Correa corta", requires_muzzle: true })).toEqual({
      severity: "alta", handling: "Correa corta", requiresMuzzle: true, handleAlone: false, noOtherDogs: false,
    });
  });
});
