import { describe, it, expect } from "vitest";
import {
  parseImportDate, decodeCsvBytes, normalizeRow, isDescriptionRow, parseMedications, parseDecimal,
} from "@/lib/importParsing";

const TODAY = new Date(2026, 8, 25); // 25/09/2026

describe("parseImportDate", () => {
  it("lee dd/mm/aaaa con el día primero", () => {
    expect(parseImportDate("10/05/2026", TODAY)).toEqual({ value: "2026-05-10" });
    expect(parseImportDate("18/09/2025", TODAY)).toEqual({ value: "2025-09-18" });
    expect(parseImportDate("31/12/2024", TODAY)).toEqual({ value: "2024-12-31" });
  });

  it("acepta ISO, año de 2 dígitos y otros separadores", () => {
    expect(parseImportDate("2019-11-06", TODAY)).toEqual({ value: "2019-11-06" });
    expect(parseImportDate("6-11-19", TODAY)).toEqual({ value: "2019-11-06" });
    expect(parseImportDate("15.11.17", TODAY)).toEqual({ value: "2017-11-15" });
  });

  it("si el segundo número no puede ser mes, asume mm/dd", () => {
    expect(parseImportDate("9/18/25", TODAY)).toEqual({ value: "2025-09-18" });
  });

  it("vacío es null sin error", () => {
    expect(parseImportDate("", TODAY)).toEqual({ value: null });
  });

  it("rechaza fechas futuras, inexistentes o texto", () => {
    expect(parseImportDate("05/10/2026", TODAY).error).toMatch(/futuro/);
    expect(parseImportDate("31/02/2025", TODAY).error).toMatch(/no es válida/);
    expect(parseImportDate("fecha_de_nacimiento", TODAY).error).toMatch(/no reconocida/);
  });
});

describe("decodeCsvBytes", () => {
  it("decodifica CSV Windows-1252 de Excel sin romper ñ/acentos", () => {
    const latin1 = new Uint8Array([0x50, 0x41, 0x54, 0x49, 0xd1, 0x4f, 0x2c, 0x41, 0x4c, 0x45, 0x4d, 0xc1, 0x4e]);
    expect(decodeCsvBytes(latin1)).toBe("PATIÑO,ALEMÁN");
  });

  it("respeta UTF-8 válido", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("PATIÑO"))).toBe("PATIÑO");
  });
});

describe("normalizeRow / isDescriptionRow", () => {
  it("convierte N/A y 'Sin microchip' en vacío y recorta espacios", () => {
    expect(normalizeRow({ " Medical_Notes ": "N/A", microchip_number: "SIN MICROCHIP", is_neutered: "FALSE " }))
      .toEqual({ medical_notes: "", microchip_number: "", is_neutered: "FALSE" });
  });

  it("detecta la fila de descripción bajo el encabezado", () => {
    expect(isDescriptionRow({ name: "nombre", breed: "raza" })).toBe(true);
    expect(isDescriptionRow({ name: "NACHO", breed: "LABRADOR" })).toBe(false);
  });
});

describe("parseMedications", () => {
  it("separa por comas cuando no se usa el formato con ':'", () => {
    expect(parseMedications("ALOPURINOL, VITAMINA E, MUNGOS").map((m) => m.name))
      .toEqual(["ALOPURINOL", "VITAMINA E", "MUNGOS"]);
  });

  it("mantiene el formato nombre:dosis:... separado por ';'", () => {
    expect(parseMedications("Apoquel:5mg:cada 12h:oral:false")[0])
      .toMatchObject({ name: "Apoquel", dose: "5mg", frequency: "cada 12h", route: "oral", with_food: false });
  });
});

describe("parseDecimal", () => {
  it("acepta coma decimal", () => {
    expect(parseDecimal("24,83")).toBe(24.83);
    expect(parseDecimal("abc")).toBeNull();
  });
});
