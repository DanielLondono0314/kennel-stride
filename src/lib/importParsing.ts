// Parseo tolerante para la importación masiva de clientes/perros (CSV/Excel).
// Los archivos llegan de kennels reales, casi siempre de Excel en español:
// CSV en Windows-1252, fechas dd/mm/aaaa, "N/A" en campos vacíos, etc.

export type RawRow = Record<string, string>;

// Valores que la gente escribe para decir "vacío".
const EMPTY_TOKENS = new Set([
  "n/a", "na", "n.a.", "n/d", "-", "--", "no aplica", "ninguno", "ninguna",
  "sin microchip", "sin chip", "null",
]);

export function cleanCell(value: unknown): string {
  const s = (value ?? "").toString().trim();
  return EMPTY_TOKENS.has(s.toLowerCase()) ? "" : s;
}

export function normalizeRow(row: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const k of Object.keys(row)) {
    out[k.trim().toLowerCase()] = cleanCell(row[k]);
  }
  return out;
}

// Excel en español guarda los CSV en Windows-1252; si el archivo no es UTF-8
// válido lo decodificamos así para no convertir "ñ"/"á" en "�".
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export interface ParsedDate {
  value: string | null;
  error?: string;
}

// Acepta aaaa-mm-dd o dd/mm/aaaa (también con "-" o "." y año de 2 dígitos).
// Día primero, como se escribe en Latinoamérica; si el segundo número no puede
// ser mes (>12) se asume mm/dd. Nunca se lo pasamos crudo a Postgres, que
// interpreta "10/05/2026" como 5 de octubre (DateStyle MDY).
export function parseImportDate(raw: string, today: Date = new Date()): ParsedDate {
  const s = raw.trim();
  if (!s) return { value: null };

  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    let a = Number(dmy[1]);
    let b = Number(dmy[2]);
    if (b > 12 && a <= 12) [a, b] = [b, a];
    d = a;
    m = b;
    y = Number(dmy[3]);
    if (dmy[3].length === 2) {
      const currentYY = today.getFullYear() % 100;
      y += y <= currentYY ? 2000 : 1900;
    }
  } else {
    return { value: null, error: `Fecha "${s}" no reconocida (usa dd/mm/aaaa)` };
  }

  if (!isRealDate(y, m, d)) return { value: null, error: `Fecha "${s}" no es válida` };
  const value = toIsoDate(y, m, d);
  if (value > toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())) {
    return { value: null, error: `Fecha de nacimiento "${s}" está en el futuro` };
  }
  return { value };
}

// Algunas plantillas traen, debajo del encabezado, una fila con la descripción
// de cada columna ("nombre", "raza", "correo_del_propietario"...). No es un dato.
export function isDescriptionRow(r: RawRow): boolean {
  const first = (r.name ?? r.first_name ?? "").toLowerCase();
  return first === "nombre" || first === "name" || first === "first_name" || first === "primer_nombre";
}

export function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function parseBool(v: string): boolean {
  return ["true", "1", "yes", "sí", "si", "x", "verdadero"].includes((v ?? "").toLowerCase());
}

export function parseDecimal(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function digitsOnly(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export interface AllergyEntry { allergen: string; type: string; reaction: string | null; severity: string | null; }
export interface MedicationEntry { name: string; dose: string | null; frequency: string | null; route: string | null; with_food: boolean; }

// Entradas separadas por ";". Si el texto no usa el formato con ":" y viene
// separado por comas ("ALOPURINOL, VITAMINA E"), cada elemento es una entrada.
function splitEntries(raw: string): string[] {
  const sep = !raw.includes(";") && !raw.includes(":") ? "," : ";";
  return raw.split(sep).map((s) => s.trim()).filter(Boolean);
}

// "alergeno:tipo:reaccion:severidad" por entrada.
export function parseAllergies(raw: string): AllergyEntry[] {
  if (!raw?.trim()) return [];
  return splitEntries(raw).map((entry) => {
    const [allergen, type, reaction, severity] = entry.split(":").map((p) => p?.trim() ?? "");
    return {
      allergen: allergen || entry,
      type: type || "comida",
      reaction: reaction || null,
      severity: severity || null,
    };
  });
}

// "nombre:dosis:frecuencia:via:con_comida" por entrada.
export function parseMedications(raw: string): MedicationEntry[] {
  if (!raw?.trim()) return [];
  return splitEntries(raw).map((entry) => {
    const [name, dose, frequency, route, withFood] = entry.split(":").map((p) => p?.trim() ?? "");
    return {
      name: name || entry,
      dose: dose || null,
      frequency: frequency || null,
      route: route || null,
      with_food: parseBool(withFood || ""),
    };
  });
}
