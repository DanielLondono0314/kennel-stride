import { describe, it, expect } from "vitest";
import { specialCareDetail, summarizeSpecialCare } from "@/lib/specialCare";

describe("cuidados especiales", () => {
  it("cuenta cada perro una vez y detalla por tipo", () => {
    const s = summarizeSpecialCare([
      { medication: true, allergies: false, aggressive: true },
      { medication: false, allergies: false, aggressive: true },
      { medication: false, allergies: false, aggressive: false },
    ]);
    expect(s).toEqual({ total: 2, medication: 1, allergies: 0, aggressive: 2 });
    expect(specialCareDetail(s)).toBe("1 con medicación · 2 de manejo especial");
    expect(specialCareDetail({ total: 0, medication: 0, allergies: 0, aggressive: 0 })).toBe("Ninguno");
  });
});
