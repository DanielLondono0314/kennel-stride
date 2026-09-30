// Matriz de planes de membresía. Espejo de `plan_features` / `plan_catalog`
// (supabase/migrations/20260924000000_membership_plans.sql), que es la fuente
// de verdad que el backend hace cumplir. Aquí solo sirve para pintar la UI
// (menú, upsell, página de facturación) sin un round-trip por cada render.

export type PlanTier = "basic" | "pro" | "premium";

export type Feature =
  | "dashboard"
  | "customers"
  | "dogs"
  | "calendar"
  | "tasks"
  | "packages"
  | "invoices"
  | "reports"
  | "routes"
  | "staff"
  | "settings"
  | "requests"
  | "notices"
  | "report_cards"
  | "route_notifications"
  | "facility"
  | "clinic"
  | "campaigns";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  /** A quién va dirigido, en una línea. */
  audience: string;
  monthlyUsd: number;
  monthlyCop: number;
  /** null = ilimitado */
  maxMembers: number | null;
  maxDogs: number | null;
  features: readonly Feature[];
}

const ESSENTIAL: readonly Feature[] = [
  "dashboard", "customers", "dogs", "calendar", "tasks", "packages",
  "invoices", "reports", "routes", "staff", "settings",
];
const PRO: readonly Feature[] = [
  ...ESSENTIAL, "requests", "notices", "report_cards", "route_notifications",
];
const PREMIUM: readonly Feature[] = [...PRO, "facility", "clinic", "campaigns"];

export const PLANS: Record<PlanTier, PlanDefinition> = {
  basic: {
    tier: "basic",
    name: "Esencial",
    audience: "Adiestradores, paseadores y profesionales independientes",
    monthlyUsd: 19,
    monthlyCop: 79_000,
    maxMembers: 2,
    maxDogs: 200,
    features: ESSENTIAL,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    audience: "Guarderías y daycares con equipo",
    monthlyUsd: 49,
    monthlyCop: 199_000,
    maxMembers: 10,
    maxDogs: 1000,
    features: PRO,
  },
  premium: {
    tier: "premium",
    name: "Premium",
    audience: "Hoteles, resorts y centros caninos completos",
    monthlyUsd: 99,
    monthlyCop: 399_000,
    maxMembers: null,
    maxDogs: null,
    features: PREMIUM,
  },
};

export const PLAN_ORDER: readonly PlanTier[] = ["basic", "pro", "premium"];

/** Nombre legible de cada módulo, para upsell y comparativas. */
export const FEATURE_LABELS: Record<Feature, string> = {
  dashboard: "Dashboard",
  customers: "Clientes",
  dogs: "Perros",
  calendar: "Calendario y agenda",
  tasks: "Tareas",
  packages: "Planes por duración o sesiones",
  invoices: "Facturación",
  reports: "Reportes",
  routes: "Rutas y transporte",
  staff: "Personal",
  settings: "Configuración",
  requests: "Solicitudes de clientes",
  notices: "Avisos",
  report_cards: "Report Cards",
  route_notifications: "Notificaciones de ruta (SMS/WhatsApp)",
  facility: "Instalaciones y perreras",
  clinic: "Clínica veterinaria",
  campaigns: "Campañas de marketing",
};

export function planHasFeature(tier: PlanTier, feature: Feature): boolean {
  return PLANS[tier].features.includes(feature);
}

/** Plan mínimo que incluye el módulo (para el mensaje "disponible desde…"). */
export function minimumTierFor(feature: Feature): PlanTier {
  return PLAN_ORDER.find((t) => planHasFeature(t, feature)) ?? "premium";
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "basic" || value === "pro" || value === "premium";
}
