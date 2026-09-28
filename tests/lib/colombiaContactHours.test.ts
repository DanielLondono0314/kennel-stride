import { describe, it, expect } from "vitest";
import { colombianHolidays, isWithinColombiaContactHours } from "../../supabase/functions/_shared/colombiaContactHours";
import { legalConfigPending } from "@/lib/legal";

// Hora de Colombia = UTC-5: las 7:00 locales son las 12:00 UTC.
const co = (isoLocal: string) => new Date(`${isoLocal}-05:00`);

describe("colombianHolidays", () => {
  it("coincide con el calendario oficial de festivos 2026", () => {
    expect([...colombianHolidays(2026)].sort()).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
      "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
      "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
      "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });
});

describe("isWithinColombiaContactHours (Ley 2300)", () => {
  it("entre semana solo de 7:00 a 19:00", () => {
    expect(isWithinColombiaContactHours(co("2026-09-29T06:59:00"))).toBe(false);
    expect(isWithinColombiaContactHours(co("2026-09-29T07:00:00"))).toBe(true);
    expect(isWithinColombiaContactHours(co("2026-09-29T18:59:00"))).toBe(true);
    expect(isWithinColombiaContactHours(co("2026-09-29T19:00:00"))).toBe(false);
  });

  it("sábado solo de 8:00 a 15:00", () => {
    expect(isWithinColombiaContactHours(co("2026-10-03T07:30:00"))).toBe(false);
    expect(isWithinColombiaContactHours(co("2026-10-03T10:00:00"))).toBe(true);
    expect(isWithinColombiaContactHours(co("2026-10-03T15:00:00"))).toBe(false);
  });

  it("nunca domingos ni festivos", () => {
    expect(isWithinColombiaContactHours(co("2026-10-04T10:00:00"))).toBe(false); // domingo
    expect(isWithinColombiaContactHours(co("2026-10-12T10:00:00"))).toBe(false); // festivo (lunes)
  });

  it("usa la hora de Colombia aunque el servidor esté en UTC", () => {
    // 2026-09-30 00:30 UTC = martes 29 a las 19:30 en Colombia → fuera de horario.
    expect(isWithinColombiaContactHours(new Date("2026-09-30T00:30:00Z"))).toBe(false);
  });
});

describe("legalConfigPending", () => {
  it("detecta datos de identidad pendientes", () => {
    expect(legalConfigPending({ nit: "PENDIENTE_NIT" })).toBe(true);
    expect(legalConfigPending({ nit: "901.234.567-8", trialDays: 14 })).toBe(false);
  });
});
