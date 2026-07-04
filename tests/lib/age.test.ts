import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getAge, parseDateOnly } from "@/lib/age";

describe("parseDateOnly", () => {
  it("parsea YYYY-MM-DD como fecha local (no UTC)", () => {
    const d = parseDateOnly("2020-05-15");
    expect(d.getFullYear()).toBe(2020);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(15); // new Date("2020-05-15") daría 14 en husos UTC-N
  });

  it("ignora la parte de hora si viene un timestamp", () => {
    const d = parseDateOnly("2020-05-15T10:30:00");
    expect(d.getDate()).toBe(15);
  });
});

describe("getAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // "Ahora" = 4 jul 2026, 22:00 hora local
    vi.setSystemTime(new Date(2026, 6, 4, 22, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el label de desconocido si no hay fecha", () => {
    expect(getAge(null)).toBe("—");
    expect(getAge(undefined)).toBe("—");
    expect(getAge(null, "Desconocida")).toBe("Desconocida");
  });

  it("años en plural y singular", () => {
    expect(getAge("2023-07-04")).toBe("3 años");
    expect(getAge("2025-07-04")).toBe("1 año");
  });

  it("meses cuando aún no cumple un año", () => {
    expect(getAge("2025-09-04")).toBe("10 meses");
    expect(getAge("2026-06-04")).toBe("1 mes");
  });

  it("0 meses para recién nacido, en plural", () => {
    expect(getAge("2026-07-01")).toBe("0 meses");
  });

  it("borde: cumple 1 año MAÑANA → sigue siendo 11 meses aunque sea de noche", () => {
    // Con new Date("2025-07-05") (UTC) en un huso UTC-5, a las 22:00 locales
    // el perro aparecería con "1 año" un día antes de cumplirlo.
    expect(getAge("2025-07-05")).toBe("11 meses");
  });
});
