import { describe, it, expect } from "vitest";
import {
  feedingSchema,
  aggressionDetailsSchema,
  allergyRowSchema,
  medicationRowSchema,
} from "@/lib/schemas";

describe("feedingSchema", () => {
  it("rechaza alimentación sin tipo ni nº de comidas", () => {
    expect(feedingSchema.safeParse({ food_type: "", meals_per_day: "" }).success).toBe(false);
  });
  it("acepta el mínimo: tipo + nº de comidas ≥1", () => {
    const r = feedingSchema.safeParse({ food_type: "seco", meals_per_day: 2 });
    expect(r.success).toBe(true);
  });
  it("rechaza meals_per_day < 1", () => {
    expect(feedingSchema.safeParse({ food_type: "seco", meals_per_day: 0 }).success).toBe(false);
  });
});

describe("aggressionDetailsSchema", () => {
  it("exige severidad y manejo", () => {
    expect(aggressionDetailsSchema.safeParse({ severity: "", handling: "" }).success).toBe(false);
    expect(
      aggressionDetailsSchema.safeParse({ severity: "alta", handling: "con cuidado" }).success
    ).toBe(true);
  });
});

describe("allergyRowSchema", () => {
  it("exige alérgeno y tipo", () => {
    expect(allergyRowSchema.safeParse({ allergen: "", type: "" }).success).toBe(false);
    expect(allergyRowSchema.safeParse({ allergen: "pollo", type: "comida" }).success).toBe(true);
  });
});

describe("medicationRowSchema", () => {
  it("exige al menos el nombre", () => {
    expect(medicationRowSchema.safeParse({ name: "" }).success).toBe(false);
    expect(medicationRowSchema.safeParse({ name: "Apoquel" }).success).toBe(true);
  });
});
