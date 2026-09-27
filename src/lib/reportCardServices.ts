import type { Specialty } from "@/lib/worker";

/**
 * Report cards adaptados al servicio. Cada servicio de la org (configurable en
 * Ajustes > Perfil del Negocio) pertenece a una categoría, y la categoría
 * decide qué se diligencia: métricas, campos propios y quién es el encargado.
 *
 * Métricas: las 4 clásicas viven en columnas (energy_level, socialization,
 * obedience, appetite) para no romper el dashboard de perros ni los reportes;
 * las propias de cada categoría van en `details.ratings`. Una métrica que no
 * aplica al servicio se guarda como NULL.
 */

export type ServiceCategory =
  | "training"
  | "grooming"
  | "vet"
  | "walk"
  | "stay"
  | "evaluation"
  | "general";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "training", "grooming", "vet", "walk", "stay", "evaluation", "general",
];

export type ColumnMetric = "energy_level" | "socialization" | "obedience" | "appetite";
export const COLUMN_METRICS: ColumnMetric[] = ["energy_level", "socialization", "obedience", "appetite"];

export interface MetricDef {
  key: string;
  label: string;
}

export type FieldDef =
  | { key: string; label: string; type: "text" | "textarea"; placeholder?: string }
  | { key: string; label: string; type: "number"; unit?: string; step?: number }
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "select"; options: string[] }
  | { key: string; label: string; type: "checklist"; options: string[] };

export interface CategoryConfig {
  label: string;
  icon: string;
  /** Cómo se llama el encargado en este servicio. */
  staffLabel: string;
  /** Especialidades que se sugieren primero como encargado. */
  specialties: Specialty[];
  /** Métricas de 1 a 5 además de la puntuación general. */
  metrics: MetricDef[];
  fields: FieldDef[];
  highlightsLabel: string;
  improveLabel: string;
  photosLabel: string;
}

const BATHROOM = ["Orinó", "Defecó", "Heces normales", "Heces blandas"];

export const CATEGORY_CONFIG: Record<ServiceCategory, CategoryConfig> = {
  training: {
    label: "Entrenamiento",
    icon: "🎓",
    staffLabel: "Entrenador",
    specialties: ["trainer"],
    metrics: [
      { key: "obedience", label: "Obediencia" },
      { key: "focus", label: "Concentración" },
      { key: "socialization", label: "Socialización" },
      { key: "energy_level", label: "Energía" },
    ],
    fields: [
      { key: "duration_min", label: "Duración", type: "number", unit: "min" },
      {
        key: "skills",
        label: "Ejercicios trabajados",
        type: "checklist",
        options: ["Sentado", "Quieto", "Echado", "Venir al llamado", "Caminar sin halar", "Dejarlo", "Junto", "Socialización", "Manejo de reactividad"],
      },
      { key: "homework", label: "Tarea para casa", type: "textarea", placeholder: "Qué debe practicar el dueño esta semana…" },
    ],
    highlightsLabel: "Logros de la sesión",
    improveLabel: "Por reforzar",
    photosLabel: "Fotos de la sesión",
  },
  grooming: {
    label: "Grooming / Spa",
    icon: "✂️",
    staffLabel: "Groomer",
    specialties: ["groomer"],
    metrics: [
      { key: "behavior", label: "Comportamiento durante el servicio" },
    ],
    fields: [
      {
        key: "services_done",
        label: "Servicios realizados",
        type: "checklist",
        options: ["Baño", "Corte", "Deslanado", "Cepillado", "Corte de uñas", "Limpieza de oídos", "Cepillado dental", "Glándulas anales", "Hidratación", "Perfume"],
      },
      { key: "coat_condition", label: "Estado del pelaje", type: "select", options: ["Excelente", "Bueno", "Con nudos", "Muy enredado"] },
      { key: "skin_findings", label: "Hallazgos en piel / pelaje", type: "textarea", placeholder: "Pulgas, garrapatas, irritación, heridas, bultos…" },
      { key: "products", label: "Productos usados", type: "text", placeholder: "Shampoo hipoalergénico, acondicionador…" },
    ],
    highlightsLabel: "Lo mejor del día",
    improveLabel: "Recomendaciones para el dueño",
    photosLabel: "Fotos (antes / después)",
  },
  vet: {
    label: "Consulta veterinaria",
    icon: "🩺",
    staffLabel: "Veterinario",
    specialties: ["vet"],
    metrics: [],
    fields: [
      { key: "reason", label: "Motivo de consulta", type: "text" },
      { key: "weight_kg", label: "Peso", type: "number", unit: "kg", step: 0.1 },
      { key: "temperature_c", label: "Temperatura", type: "number", unit: "°C", step: 0.1 },
      { key: "diagnosis", label: "Diagnóstico", type: "textarea" },
      { key: "treatment", label: "Tratamiento", type: "textarea" },
      { key: "medications", label: "Medicamentos formulados", type: "textarea", placeholder: "Nombre, dosis, frecuencia, duración…" },
      { key: "next_checkup", label: "Próximo control", type: "date" },
    ],
    highlightsLabel: "Resumen para el dueño",
    improveLabel: "Cuidados en casa",
    photosLabel: "Fotos / exámenes",
  },
  walk: {
    label: "Paseo",
    icon: "🦮",
    staffLabel: "Paseador",
    specialties: ["welfare", "trainer"],
    metrics: [
      { key: "leash_behavior", label: "Comportamiento con la correa" },
      { key: "energy_level", label: "Energía" },
      { key: "socialization", label: "Socialización" },
    ],
    fields: [
      { key: "duration_min", label: "Duración", type: "number", unit: "min" },
      { key: "distance_km", label: "Distancia", type: "number", unit: "km", step: 0.1 },
      { key: "route", label: "Recorrido / zona", type: "text", placeholder: "Parque, sendero…" },
      { key: "bathroom", label: "Necesidades", type: "checklist", options: BATHROOM },
    ],
    highlightsLabel: "Momentos destacados",
    improveLabel: "Observaciones a tener en cuenta",
    photosLabel: "Fotos del paseo",
  },
  stay: {
    label: "Guardería / Hotel",
    icon: "🏠",
    staffLabel: "Cuidador",
    specialties: ["welfare"],
    metrics: [
      { key: "energy_level", label: "Energía" },
      { key: "socialization", label: "Socialización" },
      { key: "appetite", label: "Apetito" },
    ],
    fields: [
      { key: "meals", label: "Comidas", type: "select", options: ["Comió todo", "Comió una parte", "No comió"] },
      {
        key: "activities",
        label: "Actividades",
        type: "checklist",
        options: ["Juego en grupo", "Juego individual", "Paseo", "Siesta", "Piscina", "Enriquecimiento", "Entrenamiento"],
      },
      { key: "bathroom", label: "Necesidades", type: "checklist", options: BATHROOM },
      { key: "playmates", label: "Compañeros de juego", type: "text" },
    ],
    highlightsLabel: "Lo mejor del día",
    improveLabel: "A tener en cuenta",
    photosLabel: "Fotos del día",
  },
  evaluation: {
    label: "Evaluación",
    icon: "📋",
    staffLabel: "Evaluador",
    specialties: ["trainer", "welfare"],
    metrics: [
      { key: "socialization", label: "Socialización" },
      { key: "obedience", label: "Obediencia" },
      { key: "energy_level", label: "Energía" },
    ],
    fields: [
      { key: "temperament", label: "Temperamento", type: "select", options: ["Tranquilo", "Juguetón", "Tímido", "Ansioso", "Reactivo", "Dominante"] },
      { key: "dog_compat", label: "Compatible con otros perros", type: "select", options: ["Sí", "Con supervisión", "No"] },
      { key: "recommended_service", label: "Servicio recomendado", type: "text" },
    ],
    highlightsLabel: "Fortalezas",
    improveLabel: "Recomendaciones",
    photosLabel: "Fotos",
  },
  general: {
    label: "Otro servicio",
    icon: "🐕",
    staffLabel: "Encargado",
    specialties: [],
    metrics: [
      { key: "energy_level", label: "Energía" },
      { key: "socialization", label: "Socialización" },
      { key: "obedience", label: "Obediencia" },
      { key: "appetite", label: "Apetito" },
    ],
    fields: [],
    highlightsLabel: "Logros destacados",
    improveLabel: "Áreas de mejora",
    photosLabel: "Fotos",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// El orden importa: "Internado + Entrenamiento" es entrenamiento, no hotel.
const KEYWORDS: [ServiceCategory, string[]][] = [
  ["vet", ["vet", "consulta", "clinic", "medic", "vacun"]],
  ["grooming", ["groom", "spa", "bano", "peluq", "estetic", "corte"]],
  ["training", ["train", "entren", "adiestr", "obedien", "clase"]],
  ["evaluation", ["evalua", "valorac"]],
  ["walk", ["paseo", "walk", "caminat"]],
  ["stay", ["daycare", "guarder", "hotel", "board", "internado", "hosped", "pension", "stay", "jardin"]],
];

export function inferCategory(value: string, label = ""): ServiceCategory {
  const text = normalize(`${value} ${label}`);
  for (const [category, words] of KEYWORDS) {
    if (words.some((w) => text.includes(w))) return category;
  }
  return "general";
}

export function isServiceCategory(v: unknown): v is ServiceCategory {
  return typeof v === "string" && (SERVICE_CATEGORIES as string[]).includes(v);
}

/** Categoría de un servicio: la configurada en Ajustes o, si no hay, la inferida del nombre. */
export function categoryOf(service: { value: string; label: string; category?: string } | undefined, fallbackValue = ""): ServiceCategory {
  if (service && isServiceCategory(service.category)) return service.category;
  return inferCategory(service?.value ?? fallbackValue, service?.label ?? "");
}

export type DetailValue = string | number | string[];

export interface ReportCardDetails {
  values?: Record<string, DetailValue>;
  ratings?: Record<string, number>;
  /** Versión legible (etiqueta → valor) para el detalle, el correo y el historial del perro. */
  summary?: { label: string; value: string }[];
  metrics?: { label: string; value: number }[];
  service_label?: string;
  staff_label?: string;
}

export function isEmptyValue(v: DetailValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

export function formatFieldValue(field: FieldDef, v: DetailValue): string {
  if (Array.isArray(v)) return v.join(", ");
  if (field.type === "number" && field.unit) return `${v} ${field.unit}`;
  if (field.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return String(v);
}

export function isColumnMetric(key: string): key is ColumnMetric {
  return (COLUMN_METRICS as string[]).includes(key);
}

/**
 * Arma las columnas de métricas y el `details` a guardar para una categoría:
 * métricas que no aplican → NULL, valores vacíos fuera, y el resumen legible.
 */
export function buildReportCardPayload(input: {
  category: ServiceCategory;
  serviceLabel: string;
  overall: number;
  ratings: Record<string, number>;
  values: Record<string, DetailValue>;
}) {
  const cfg = CATEGORY_CONFIG[input.category];
  const columns: Record<ColumnMetric, number | null> = {
    energy_level: null, socialization: null, obedience: null, appetite: null,
  };
  const extraRatings: Record<string, number> = {};
  const metrics: { label: string; value: number }[] = [{ label: "Puntuación general", value: input.overall }];

  for (const m of cfg.metrics) {
    const v = input.ratings[m.key] ?? 3;
    if (isColumnMetric(m.key)) columns[m.key] = v;
    else extraRatings[m.key] = v;
    metrics.push({ label: m.label, value: v });
  }

  const values: Record<string, DetailValue> = {};
  const summary: { label: string; value: string }[] = [];
  for (const f of cfg.fields) {
    const v = input.values[f.key];
    if (isEmptyValue(v)) continue;
    values[f.key] = v;
    summary.push({ label: f.label, value: formatFieldValue(f, v) });
  }

  const details: ReportCardDetails = {
    values,
    ratings: extraRatings,
    summary,
    metrics,
    service_label: input.serviceLabel,
    staff_label: cfg.staffLabel,
  };
  return { columns, details };
}

/** Métricas legibles de un report card, incluso de los creados antes de `details`. */
export function readMetrics(rc: {
  overall_score: number;
  energy_level: number | null;
  socialization: number | null;
  obedience: number | null;
  appetite: number | null;
  details?: unknown;
}): { label: string; value: number }[] {
  const d = (rc.details ?? {}) as ReportCardDetails;
  if (d.metrics?.length) return d.metrics;
  const legacy: [string, number | null][] = [
    ["Puntuación general", rc.overall_score],
    ["Energía", rc.energy_level],
    ["Socialización", rc.socialization],
    ["Obediencia", rc.obedience],
    ["Apetito", rc.appetite],
  ];
  return legacy.filter((m): m is [string, number] => m[1] != null).map(([label, value]) => ({ label, value }));
}

export function readDetails(details: unknown): ReportCardDetails {
  return details && typeof details === "object" ? (details as ReportCardDetails) : {};
}
