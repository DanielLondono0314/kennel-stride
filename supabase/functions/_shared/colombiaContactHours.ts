// Ley 2300 de 2023: horarios permitidos para contactar a consumidores con fines
// publicitarios o de cobranza — lunes a viernes 7:00–19:00, sábados 8:00–15:00,
// nunca domingos ni festivos (hora de Colombia, UTC-5 sin horario de verano).
// Sin dependencias de Deno: lo usa send-campaign y lo prueba vitest.

const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

/** Traslada al lunes siguiente si no cae en lunes (Ley 51 de 1983, "Ley Emiliani"). */
function nextMonday(d: Date): Date {
  const dow = d.getUTCDay();
  return dow === 1 ? d : addDays(d, (8 - dow) % 7);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Festivos de Colombia (YYYY-MM-DD) para un año. */
export function colombianHolidays(year: number): Set<string> {
  const date = (m: number, d: number) => new Date(Date.UTC(year, m - 1, d));
  const easter = easterSunday(year);
  const days: Date[] = [
    // Fijos
    date(1, 1), date(5, 1), date(7, 20), date(8, 7), date(12, 8), date(12, 25),
    // Trasladables al lunes
    nextMonday(date(1, 6)), nextMonday(date(3, 19)), nextMonday(date(6, 29)),
    nextMonday(date(8, 15)), nextMonday(date(10, 12)), nextMonday(date(11, 1)),
    nextMonday(date(11, 11)),
    // Según la Pascua
    addDays(easter, -3), // Jueves Santo
    addDays(easter, -2), // Viernes Santo
    nextMonday(addDays(easter, 39)), // Ascensión
    nextMonday(addDays(easter, 60)), // Corpus Christi
    nextMonday(addDays(easter, 68)), // Sagrado Corazón
  ];
  return new Set(days.map(ymd));
}

/** true si `now` está dentro de los horarios permitidos por la Ley 2300 de 2023. */
export function isWithinColombiaContactHours(now: Date = new Date()): boolean {
  const local = new Date(now.getTime() + COLOMBIA_OFFSET_MS);
  const dow = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (dow === 0 || colombianHolidays(local.getUTCFullYear()).has(ymd(local))) return false;
  if (dow === 6) return minutes >= 8 * 60 && minutes < 15 * 60;
  return minutes >= 7 * 60 && minutes < 19 * 60;
}

export const CONTACT_HOURS_MESSAGE =
  "Por la Ley 2300 de 2023 solo se pueden enviar campañas de lunes a viernes de 7:00 a 19:00 y sábados de 8:00 a 15:00 (hora de Colombia), sin domingos ni festivos.";
