import { describe, it, expect } from "vitest";
import "@/lib/zodEs";
import { z } from "zod";
import { feedingSchema, medicationRowSchema, allergyRowSchema, customerSchema } from "@/lib/schemas";
import { zodFieldErrors } from "@/lib/forms";

const base = { food_type: "seco", brand: "", meals_per_day: 2, instructions: "" };

describe("feedingSchema (QA E-01)", () => {
  it("acepta Porción y Unidad vacías: no tienen asterisco", () => {
    expect(feedingSchema.safeParse({ ...base, portion_amount: "", portion_unit: "" }).success).toBe(true);
    expect(feedingSchema.safeParse({ ...base, portion_amount: null, portion_unit: null }).success).toBe(true);
  });

  it("acepta porción con unidad", () => {
    expect(feedingSchema.safeParse({ ...base, portion_amount: 150, portion_unit: "g" }).success).toBe(true);
  });

  it("pide la unidad si se escribió una porción", () => {
    const r = feedingSchema.safeParse({ ...base, portion_amount: 150, portion_unit: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodFieldErrors(r.error)).toEqual({ portion_unit: "Elige la unidad de la porción" });
  });

  it("rechaza una porción de 0 con mensaje en español", () => {
    const r = feedingSchema.safeParse({ ...base, portion_amount: 0, portion_unit: "g" });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodFieldErrors(r.error).portion_amount).toBe("La porción debe ser mayor a 0");
  });
});

describe("filas opcionales de salud", () => {
  it("medicamento sin duración ni vía es válido", () => {
    expect(medicationRowSchema.safeParse({ name: "Apoquel", duration_days: "", route: "" }).success).toBe(true);
  });

  it("alergia sin severidad es válida", () => {
    expect(allergyRowSchema.safeParse({ allergen: "Pollo", type: "comida", severity: "" }).success).toBe(true);
  });
});

describe("mensajes de Zod en español (QA E-13)", () => {
  it("traduce los mensajes por defecto", () => {
    const r = z.object({ weight: z.number().positive() }).safeParse({ weight: -1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Debe ser mayor a 0");
  });
});


describe("documento del cliente (QA E-12)", () => {
  const base = { first_name: "Ana", last_name: "Gómez", email: "ana@correo.com", phone: "3001234567" };
  const parse = (id_document_type: string, id_document: string) =>
    customerSchema.safeParse({ ...base, id_document_type, id_document }).success;

  it("rechaza letras en la cédula", () => {
    expect(parse("CC", "abc")).toBe(false);
    expect(parse("CC", "1.020.304.050")).toBe(true);
  });

  it("valida el NIT con dígito de verificación", () => {
    expect(parse("NIT", "900.123.456-7")).toBe(true);
    expect(parse("NIT", "12")).toBe(false);
  });

  it("el pasaporte admite letras", () => {
    expect(parse("PA", "AB123456")).toBe(true);
  });
});
