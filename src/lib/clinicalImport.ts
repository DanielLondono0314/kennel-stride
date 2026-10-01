// Importación de historia clínica desde otras plataformas (OkVet, Vetesoft,
// hojas de Excel propias…). Lógica pura y testeable: leer columnas con los
// nombres que usa cada plataforma, detectar qué tipo de registro trae cada
// archivo, emparejar cada fila con un perro de la organización y validar.
// Lo que se inserta lo decide el RPC import_clinical_records (duplicados,
// perros de otra org, peso actual del perro) en una sola transacción.

import { cleanCell, parseDecimal, parseImportDate } from "@/lib/importParsing";

export type ClinicalKind = "medical" | "vaccines" | "deworming" | "weights";

/** Orden de importación: las consultas primero, para que los pesos repetidos se detecten. */
export const KIND_ORDER: ClinicalKind[] = ["medical", "vaccines", "deworming", "weights"];

export const KIND_LABELS: Record<ClinicalKind, string> = {
  medical: "Consultas e historia médica",
  vaccines: "Vacunas",
  deworming: "Desparasitaciones",
  weights: "Pesos",
};

// ── Columnas ──────────────────────────────────────────────────────────────────

/** "Fecha de Aplicación" → "fecha_de_aplicacion". */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Texto comparable para nombres de perros y dueños. */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type FieldMap = Record<string, string[]>;

const COMMON: FieldMap = {
  dog_id: ["dog_id", "id_perro", "perro_id", "id_mascota", "mascota_id", "kennelops_dog_id"],
  dog_name: ["dog_name", "perro", "nombre_perro", "nombre_del_perro", "mascota", "nombre_mascota", "nombre_de_la_mascota", "paciente", "nombre_paciente", "nombre", "name", "pet", "pet_name"],
  microchip: ["microchip", "microchip_number", "chip", "numero_microchip", "no_microchip"],
  owner_name: ["owner", "owner_name", "propietario", "nombre_propietario", "dueno", "nombre_dueno", "cliente", "nombre_cliente", "tutor", "responsable_mascota"],
  owner_phone: ["owner_phone", "telefono", "telefono_propietario", "celular", "celular_propietario", "telefono_cliente", "phone"],
  veterinarian: ["veterinarian", "veterinario", "medico", "medico_veterinario", "doctor", "profesional", "atendido_por", "vet"],
  notes: ["notes", "notas", "observaciones", "observacion", "comentarios", "nota"],
};

const FIELDS: Record<ClinicalKind, FieldMap> = {
  medical: {
    record_date: ["record_date", "fecha", "fecha_consulta", "fecha_de_consulta", "fecha_atencion", "fecha_de_atencion", "date"],
    record_type: ["record_type", "tipo", "tipo_registro", "tipo_de_registro", "tipo_consulta", "tipo_de_consulta", "tipo_atencion", "type"],
    reason: ["reason", "motivo", "motivo_consulta", "motivo_de_consulta", "asunto", "anamnesis_motivo"],
    diagnosis: ["diagnosis", "diagnostico", "diagnosticos", "impresion_diagnostica", "dx"],
    treatment: ["treatment", "tratamiento", "plan", "plan_terapeutico", "procedimiento"],
    prescription: ["prescription", "formula", "formula_medica", "formulas", "receta", "medicamentos", "prescripcion", "medicacion"],
    weight: ["weight", "peso", "peso_kg"],
    temperature: ["temperature", "temperatura", "temp", "temperatura_c", "temp_c"],
    heart_rate: ["heart_rate", "frecuencia_cardiaca", "fc", "pulso"],
    respiratory_rate: ["respiratory_rate", "frecuencia_respiratoria", "fr"],
    blood_pressure: ["blood_pressure", "presion_arterial", "presion", "pa", "tension_arterial"],
    body_condition_score: ["body_condition_score", "condicion_corporal", "bcs"],
    next_appointment: ["next_appointment", "proxima_cita", "proximo_control", "fecha_proximo_control", "fecha_proxima_cita"],
  },
  vaccines: {
    date_administered: ["date_administered", "fecha", "fecha_aplicacion", "fecha_de_aplicacion", "fecha_vacuna", "fecha_vacunacion", "date"],
    vaccine_name: ["vaccine_name", "vacuna", "nombre_vacuna", "nombre_de_la_vacuna", "biologico", "producto", "vaccine"],
    vaccine_type: ["vaccine_type", "tipo", "tipo_vacuna", "tipo_de_vacuna"],
    next_dose_date: ["next_dose_date", "proxima_dosis", "fecha_proxima_dosis", "refuerzo", "fecha_refuerzo", "proxima_aplicacion", "proxima_vacuna", "revacunacion"],
    batch_number: ["batch_number", "lote", "numero_lote", "no_lote"],
  },
  deworming: {
    date_administered: ["date_administered", "fecha", "fecha_aplicacion", "fecha_de_aplicacion", "fecha_desparasitacion", "date"],
    product_name: ["product_name", "producto", "desparasitante", "medicamento", "nombre_producto", "product"],
    product_type: ["product_type", "tipo", "tipo_desparasitacion", "tipo_de_desparasitacion", "via"],
    next_dose_date: ["next_dose_date", "proxima_dosis", "fecha_proxima_dosis", "proxima_desparasitacion", "proxima_aplicacion"],
    weight_at_time: ["weight_at_time", "peso", "peso_kg"],
  },
  weights: {
    recorded_at: ["recorded_at", "fecha", "fecha_pesaje", "fecha_peso", "date"],
    weight: ["weight", "peso", "peso_kg"],
    body_condition_score: ["body_condition_score", "condicion_corporal", "bcs"],
  },
};

/** Columna del archivo que corresponde a cada campo (null si no viene). */
export function mapColumns(headers: string[], kind: ClinicalKind): Record<string, string | null> {
  const byNorm = new Map(headers.map((h) => [normalizeHeader(h), h]));
  const fields = { ...COMMON, ...FIELDS[kind] };
  const out: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(fields)) {
    out[field] = aliases.map((a) => byNorm.get(a)).find((h) => h !== undefined) ?? null;
  }
  return out;
}

/**
 * Qué trae un archivo, por sus columnas y su nombre. null si no se reconoce
 * (por ejemplo una hoja de resumen): se deja sin importar.
 */
export function detectKind(headers: string[], fileName = ""): ClinicalKind | null {
  const h = new Set(headers.map(normalizeHeader));
  const has = (...names: string[]) => names.some((n) => h.has(n));
  const name = normalizeHeader(fileName);
  const hasDog = has(...COMMON.dog_id, ...COMMON.dog_name, ...COMMON.microchip);
  if (!hasDog) return null;

  if (has("vaccine_name", "vacuna", "nombre_vacuna", "nombre_de_la_vacuna", "biologico", "vaccine") || (/vacun|vaccin/.test(name) && has("producto")))
    return "vaccines";
  if (has("desparasitante", "product_name", "tipo_desparasitacion", "fecha_desparasitacion") || (/desparas|deworm/.test(name) && has("producto", "medicamento")))
    return "deworming";
  if (has(...FIELDS.medical.reason, ...FIELDS.medical.diagnosis, ...FIELDS.medical.treatment, ...FIELDS.medical.prescription, "record_type"))
    return "medical";
  if (has(...FIELDS.weights.weight) && has(...FIELDS.weights.recorded_at)) return "weights";
  return null;
}

// ── Valores ───────────────────────────────────────────────────────────────────

const RECORD_TYPES: [RegExp, string][] = [
  [/ingreso|admision|admission/, "admission_checkup"],
  [/cirug|surgery|quirurg|procedimiento/, "surgery"],
  [/urgencia|emergencia|emergency/, "emergency"],
  [/dental|odonto|profilaxis/, "dental"],
  [/laborator|examen|lab|hemograma|analisis/, "laboratory"],
  [/imagen|imaging|rx|radiograf|ecograf|ultrason/, "imaging"],
  [/control|seguimiento|checkup|chequeo|revision|revaloracion/, "checkup"],
  [/consult|general|remision|valoracion/, "consultation"],
];

const VALID_RECORD_TYPES = new Set(["admission_checkup", "consultation", "surgery", "emergency", "checkup", "dental", "laboratory", "imaging"]);

/** Tipo de registro de KennelOps; `original` se guarda en notas si no se reconoce. */
export function mapRecordType(raw: string): { value: string; original: string | null } {
  const s = normalizeHeader(raw);
  if (!s) return { value: "consultation", original: null };
  if (VALID_RECORD_TYPES.has(s)) return { value: s, original: null };
  const hit = RECORD_TYPES.find(([re]) => re.test(s));
  return hit ? { value: hit[1], original: null } : { value: "consultation", original: raw.trim() };
}

export function mapProductType(raw: string): string {
  const s = normalizeHeader(raw);
  if (/mixt|both|ambas|interna_y_externa|interno_y_externo/.test(s)) return "both";
  if (/extern|external|topic|pipeta|collar/.test(s)) return "external";
  return "internal";
}

export function mapVaccineType(raw: string): string {
  const s = normalizeHeader(raw);
  if (/refuerzo|booster/.test(s)) return "booster";
  if (/no_esencial|non_core|opcional|noncore/.test(s)) return "non_core";
  return "core";
}

/** Fecha de un registro clínico: admite "03/06/2026 10:30" y Excel ya convertido. */
function parseDate(raw: string, label: string, allowFuture = false): { value: string | null; error?: string } {
  const s = raw.trim().replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?\s?m\.?)?$/i, "");
  return parseImportDate(s, new Date(), { allowFuture, label });
}

function num(raw: string): number | null {
  // "28 kg", "38,5 °C" → número
  const m = raw.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseDecimal(m[0]) : null;
}

/** Número dentro de un rango razonable; fuera de él se descarta con un aviso. */
function inRange(v: number | null, min: number, max: number): number | null {
  return v !== null && v > min && v < max ? v : null;
}

// ── Perros ────────────────────────────────────────────────────────────────────

export interface OrgDog {
  id: string;
  name: string;
  microchip_number: string | null;
  owner_name: string | null;
  owner_phone: string | null;
}

export interface DogIndex {
  byId: Map<string, OrgDog>;
  byChip: Map<string, OrgDog>;
  byName: Map<string, OrgDog[]>;
}

export function buildDogIndex(dogs: OrgDog[]): DogIndex {
  const byName = new Map<string, OrgDog[]>();
  for (const d of dogs) {
    const k = normalizeName(d.name);
    byName.set(k, [...(byName.get(k) ?? []), d]);
  }
  return {
    byId: new Map(dogs.map((d) => [d.id, d])),
    byChip: new Map(dogs.filter((d) => d.microchip_number?.trim()).map((d) => [d.microchip_number!.replace(/\s/g, ""), d])),
    byName,
  };
}

export type DogMatch =
  | { dog: OrgDog; by: "id" | "microchip" | "name" | "name_owner" }
  | { dog: null; reason: "not_found" | "ambiguous" | "missing" };

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);

/**
 * Perro de la fila: por id de KennelOps, microchip, o nombre (y dueño si hay
 * varios con el mismo nombre). Sin coincidencia segura → no se importa.
 */
export function matchDog(
  ref: { dogId?: string; microchip?: string; dogName?: string; ownerName?: string; ownerPhone?: string },
  index: DogIndex,
): DogMatch {
  if (ref.dogId && index.byId.has(ref.dogId)) return { dog: index.byId.get(ref.dogId)!, by: "id" };
  const chip = ref.microchip?.replace(/\s/g, "");
  if (chip && index.byChip.has(chip)) return { dog: index.byChip.get(chip)!, by: "microchip" };
  if (!ref.dogName?.trim()) return { dog: null, reason: ref.dogId ? "not_found" : "missing" };

  const candidates = index.byName.get(normalizeName(ref.dogName)) ?? [];
  if (candidates.length === 0) return { dog: null, reason: "not_found" };

  const owner = normalizeName(ref.ownerName);
  const phone = digits(ref.ownerPhone);
  if (owner || phone) {
    const ownerTokens = owner.split(" ").filter((t) => t.length > 2);
    const byOwner = candidates.filter((d) => {
      if (phone && digits(d.owner_phone) === phone) return true;
      const dn = normalizeName(d.owner_name);
      return ownerTokens.length > 0 && ownerTokens.every((t) => dn.includes(t));
    });
    if (byOwner.length === 1) return { dog: byOwner[0], by: "name_owner" };
    if (byOwner.length > 1) return { dog: null, reason: "ambiguous" };
    // El dueño no coincide con ninguno: mejor no adivinar.
    return { dog: null, reason: candidates.length === 1 ? "not_found" : "ambiguous" };
  }
  return candidates.length === 1 ? { dog: candidates[0], by: "name" } : { dog: null, reason: "ambiguous" };
}

// ── Filas ─────────────────────────────────────────────────────────────────────

export interface ClinicalRecord {
  /** Fila del archivo (1 = primera fila de datos + encabezado). */
  row: number;
  dogId: string;
  dogName: string;
  data: Record<string, string | number | null>;
}

export interface RowIssue {
  row: number;
  dogName: string;
  reason: string;
}

export interface ParsedClinicalFile {
  kind: ClinicalKind;
  records: ClinicalRecord[];
  /** Filas cuyo perro no está en la organización (se ignoran). */
  noDog: RowIssue[];
  /** Filas con datos inválidos (no se importan). */
  errors: RowIssue[];
  /** Datos corregidos o descartados sin perder la fila. */
  warnings: RowIssue[];
  /** Campos de KennelOps que se encontraron en el archivo. */
  mapped: string[];
}

const NO_DOG_REASON: Record<"not_found" | "ambiguous" | "missing", string> = {
  not_found: "El perro no está registrado en el centro",
  ambiguous: "Hay varios perros con ese nombre; agrega el dueño o el id del perro",
  missing: "La fila no dice de qué perro es",
};

export function parseClinicalRows(rows: Record<string, unknown>[], kind: ClinicalKind, dogs: DogIndex): ParsedClinicalFile {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const cols = mapColumns(headers, kind);
  const out: ParsedClinicalFile = {
    kind,
    records: [],
    noDog: [],
    errors: [],
    warnings: [],
    mapped: Object.entries(cols).filter(([, c]) => c).map(([f]) => f),
  };

  rows.forEach((raw, i) => {
    const row = i + 2; // +1 encabezado, +1 base 1
    const get = (field: string) => (cols[field] ? cleanCell(raw[cols[field]!]) : "");
    if (Object.values(raw).every((v) => !cleanCell(v))) return; // fila vacía

    const dogName = get("dog_name");
    const match = matchDog(
      { dogId: get("dog_id"), microchip: get("microchip"), dogName, ownerName: get("owner_name"), ownerPhone: get("owner_phone") },
      dogs,
    );
    if (!match.dog) {
      out.noDog.push({ row, dogName: dogName || get("dog_id") || "—", reason: NO_DOG_REASON[match.reason] });
      return;
    }
    const dog = match.dog;
    const issue = (list: RowIssue[], reason: string) => list.push({ row, dogName: dog.name, reason });
    const notes: string[] = [];
    const note = get("notes");
    if (note) notes.push(note);

    const date = (field: string, label: string, required: boolean, allowFuture = false): string | null | undefined => {
      const v = get(field);
      if (!v) {
        if (required) issue(out.errors, `Falta la ${label.toLowerCase()}`);
        return required ? undefined : null;
      }
      const d = parseDate(v, label, allowFuture);
      if (d.error) {
        if (required) issue(out.errors, d.error);
        else issue(out.warnings, `${d.error}; se deja vacía`);
        return required ? undefined : null;
      }
      return d.value;
    };
    const measure = (field: string, label: string, min: number, max: number, int = false): number | null => {
      const v = get(field);
      if (!v) return null;
      const n = inRange(num(v), min, max);
      if (n === null) {
        issue(out.warnings, `${label} "${v}" fuera de rango; se omite`);
        return null;
      }
      return int ? Math.round(n) : n;
    };

    let data: Record<string, string | number | null>;
    if (kind === "medical") {
      const recordDate = date("record_date", "Fecha", true);
      if (recordDate === undefined) return;
      const type = mapRecordType(get("record_type"));
      if (type.original) notes.push(`Tipo en el sistema anterior: ${type.original}`);
      const reason = get("reason");
      const diagnosis = get("diagnosis");
      const treatment = get("treatment");
      const prescription = get("prescription");
      if (!reason && !diagnosis && !treatment && !prescription && notes.length === 0) {
        issue(out.errors, "La consulta no trae motivo, diagnóstico, tratamiento ni notas");
        return;
      }
      data = {
        record_date: recordDate,
        record_type: type.value,
        veterinarian: get("veterinarian"),
        reason: reason || (diagnosis ? "Consulta" : "Registro importado"),
        diagnosis,
        treatment,
        prescription,
        weight: measure("weight", "Peso", 0, 200),
        temperature: measure("temperature", "Temperatura", 30, 45),
        heart_rate: measure("heart_rate", "Frecuencia cardiaca", 0, 400, true),
        respiratory_rate: measure("respiratory_rate", "Frecuencia respiratoria", 0, 200, true),
        blood_pressure: get("blood_pressure") || null,
        body_condition_score: measure("body_condition_score", "Condición corporal", 0, 10, true),
        notes: notes.join("\n"),
        next_appointment: date("next_appointment", "Próxima cita", false, true) ?? null,
      };
    } else if (kind === "vaccines" || kind === "deworming") {
      const applied = date("date_administered", "Fecha de aplicación", true);
      if (applied === undefined) return;
      const product = get(kind === "vaccines" ? "vaccine_name" : "product_name");
      if (!product) {
        issue(out.errors, kind === "vaccines" ? "Falta el nombre de la vacuna" : "Falta el producto");
        return;
      }
      const common = {
        date_administered: applied,
        next_dose_date: date("next_dose_date", "Próxima dosis", false, true) ?? null,
        veterinarian: get("veterinarian"),
        notes: notes.join("\n"),
      };
      data = kind === "vaccines"
        ? { ...common, vaccine_name: product, vaccine_type: mapVaccineType(get("vaccine_type")), batch_number: get("batch_number") }
        : { ...common, product_name: product, product_type: mapProductType(get("product_type")), weight_at_time: measure("weight_at_time", "Peso", 0, 200) };
    } else {
      const recorded = date("recorded_at", "Fecha", true);
      if (recorded === undefined) return;
      const w = inRange(num(get("weight")), 0, 200);
      if (w === null) {
        issue(out.errors, get("weight") ? `Peso "${get("weight")}" no válido` : "Falta el peso");
        return;
      }
      data = {
        recorded_at: recorded,
        weight: w,
        body_condition_score: measure("body_condition_score", "Condición corporal", 0, 10, true),
        notes: notes.join("\n") || null,
      };
    }

    out.records.push({ row, dogId: dog.id, dogName: dog.name, data: { dog_id: dog.id, ...data } });
  });

  return out;
}

/**
 * Pesos que ya vienen dentro de una consulta del mismo archivo/lote (mismo
 * perro, día y peso): se quitan antes de importar para no mostrarlos dos veces.
 */
export function dropWeightsInConsultations(weights: ClinicalRecord[], medical: ClinicalRecord[]): { kept: ClinicalRecord[]; dropped: number } {
  const keys = new Set(
    medical.filter((m) => m.data.weight != null).map((m) => `${m.dogId}|${m.data.record_date}|${Number(m.data.weight)}`),
  );
  const kept = weights.filter((w) => !keys.has(`${w.dogId}|${w.data.recorded_at}|${Number(w.data.weight)}`));
  return { kept, dropped: weights.length - kept.length };
}

/** Clave de un registro para reconocerlo aunque venga en otro archivo u otro formato. */
export function recordKey(r: ClinicalRecord, kind: ClinicalKind): string {
  const n = (v: unknown) => normalizeName(v == null ? "" : String(v));
  const d = r.data;
  if (kind === "medical") return [r.dogId, d.record_date, n(d.reason), n(d.diagnosis), n(d.treatment), n(d.prescription)].join("|");
  if (kind === "vaccines") return [r.dogId, d.date_administered, n(d.vaccine_name)].join("|");
  if (kind === "deworming") return [r.dogId, d.date_administered, n(d.product_name)].join("|");
  return [r.dogId, d.recorded_at, Number(d.weight)].join("|");
}

/**
 * Entre varios archivos del mismo tipo (p. ej. el CSV y el Excel de la misma
 * exportación) se queda la primera aparición de cada registro.
 */
export function dropRepeatedAcrossFiles(files: { kind: ClinicalKind; records: ClinicalRecord[] }[]): number[] {
  const seen = new Map<ClinicalKind, Set<string>>();
  return files.map((f) => {
    const keys = seen.get(f.kind) ?? new Set<string>();
    seen.set(f.kind, keys);
    const before = f.records.length;
    const kept: ClinicalRecord[] = [];
    const local = new Set<string>();
    for (const r of f.records) {
      const k = recordKey(r, f.kind);
      if (keys.has(k)) continue; // ya vino en un archivo anterior
      local.add(k);
      kept.push(r);
    }
    for (const k of local) keys.add(k);
    f.records = kept;
    return before - kept.length;
  });
}

/** Plantillas CSV con las columnas que entiende el importador. */
export const CLINICAL_TEMPLATES: Record<ClinicalKind, { file: string; csv: string }> = {
  medical: {
    file: "historia_clinica_consultas.csv",
    csv:
      "dog_name,owner_name,record_date,record_type,veterinarian,reason,diagnosis,treatment,prescription,weight,temperature,heart_rate,respiratory_rate,body_condition_score,next_appointment,notes\n" +
      "Firulais,Juan Pérez,15/03/2026,Consulta,Dra. Ana Gómez,Vómito,Gastritis,Dieta blanda 3 días,Omeprazol 20 mg cada 24 h,28,38.6,90,24,5,22/03/2026,Control en una semana\n",
  },
  vaccines: {
    file: "historia_clinica_vacunas.csv",
    csv:
      "dog_name,owner_name,date_administered,vaccine_name,vaccine_type,next_dose_date,batch_number,veterinarian,notes\n" +
      "Firulais,Juan Pérez,10/01/2026,Rabia,Esencial,10/01/2027,L-2231,Dra. Ana Gómez,\n",
  },
  deworming: {
    file: "historia_clinica_desparasitaciones.csv",
    csv:
      "dog_name,owner_name,date_administered,product_name,product_type,next_dose_date,weight_at_time,veterinarian,notes\n" +
      "Firulais,Juan Pérez,05/02/2026,Fenbendazol,Interna,05/05/2026,28,Dra. Ana Gómez,\n",
  },
  weights: {
    file: "historia_clinica_pesos.csv",
    csv: "dog_name,owner_name,recorded_at,weight,body_condition_score,notes\nFirulais,Juan Pérez,15/03/2026,28,5,\n",
  },
};
