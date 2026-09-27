// Datos de identidad legal del operador de la plataforma y versiones de los
// documentos legales. ÚNICO lugar a editar cuando se constituya la sociedad y
// se defina la marca: todas las páginas legales y formularios leen de aquí.
//
// Mientras algún valor empiece por "PENDIENTE", las páginas legales muestran un
// aviso de "documento en revisión" (legalConfigPending).
//
// Al cambiar el TEXTO de un documento, sube su `version` y `updatedAt`: las
// aceptaciones se guardan con la versión vigente (tabla legal_acceptances).

export const LEGAL = {
  /** Nombre comercial del producto. */
  brand: "KennelOps",
  /** Razón social de la sociedad operadora (p. ej. "Kennel Tech S.A.S."). */
  companyName: "PENDIENTE_RAZON_SOCIAL",
  nit: "PENDIENTE_NIT",
  address: "PENDIENTE_DIRECCION",
  city: "PENDIENTE_CIUDAD",
  /** Buzón para consultas y reclamos sobre datos personales (Ley 1581). */
  dataEmail: "PENDIENTE_CORREO_DATOS",
  phone: "PENDIENTE_TELEFONO",
  /** Correo o canal de soporte general. */
  supportEmail: "PENDIENTE_CORREO_SOPORTE",
  /** Debe coincidir con el trial de create_organization (14 días). */
  trialDays: 14,
  /** Días para exportar datos tras terminar la suscripción. */
  exportDays: 30,
  /** Tope de responsabilidad: lo pagado en estos últimos meses. */
  liabilityMonths: 12,
} as const;

export type LegalDocKey = "terms" | "privacy" | "data_processing" | "cookies";

export const LEGAL_DOCS: Record<LegalDocKey, { title: string; path: string; version: string; updatedAt: string }> = {
  terms: { title: "Términos y Condiciones", path: "/terminos", version: "2026-09-29", updatedAt: "29 de septiembre de 2026" },
  privacy: { title: "Política de Tratamiento de Datos Personales", path: "/privacidad", version: "2026-09-29", updatedAt: "29 de septiembre de 2026" },
  data_processing: { title: "Contrato de Transmisión de Datos Personales", path: "/transmision-datos", version: "2026-09-29", updatedAt: "29 de septiembre de 2026" },
  cookies: { title: "Política de Cookies", path: "/cookies", version: "2026-09-29", updatedAt: "29 de septiembre de 2026" },
};

/** Modelo de autorización que cada guardería hace firmar a sus clientes. */
export const CUSTOMER_AUTHORIZATION_PATH = "/autorizacion-clientes";

export function legalConfigPending(config: Record<string, unknown> = LEGAL): boolean {
  return Object.values(config).some((v) => typeof v === "string" && v.startsWith("PENDIENTE"));
}

/** Nombre del operador para los textos: razón social si ya existe, si no la marca. */
export function operatorName(): string {
  return LEGAL.companyName.startsWith("PENDIENTE") ? LEGAL.brand : LEGAL.companyName;
}
