// Contratos: plantillas con variables {{...}} que se llenan con los datos del
// cliente, perro, servicio, fechas y valores, y se imprimen para firma física.
//
// Formato de la plantilla (texto plano, pensado para pegar desde Word):
//   # Título            → encabezado centrado
//   ## Subtítulo        → encabezado de sección
//   **negrita**         → negrita
//   línea en blanco     → nuevo párrafo
//   {{variable}}        → se reemplaza por su valor

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";

export interface ContractVariable {
  key: string;
  label: string;
  group: "Negocio" | "Cliente" | "Perro" | "Servicio" | "Fechas";
}

export const CONTRACT_VARIABLES: ContractVariable[] = [
  { key: "negocio_nombre", label: "Nombre del negocio", group: "Negocio" },
  { key: "negocio_direccion", label: "Dirección del negocio", group: "Negocio" },
  { key: "negocio_ciudad", label: "Ciudad del negocio", group: "Negocio" },
  { key: "negocio_telefono", label: "Teléfono del negocio", group: "Negocio" },
  { key: "negocio_email", label: "Email del negocio", group: "Negocio" },

  { key: "cliente_nombre", label: "Nombre completo", group: "Cliente" },
  { key: "cliente_tipo_documento", label: "Tipo de documento", group: "Cliente" },
  { key: "cliente_documento", label: "Número de documento", group: "Cliente" },
  { key: "cliente_telefono", label: "Teléfono", group: "Cliente" },
  { key: "cliente_email", label: "Email", group: "Cliente" },
  { key: "cliente_direccion", label: "Dirección", group: "Cliente" },
  { key: "cliente_ciudad", label: "Ciudad", group: "Cliente" },
  { key: "contacto_emergencia", label: "Contacto de emergencia", group: "Cliente" },

  { key: "mascotas", label: "Lista de mascotas (todas)", group: "Perro" },
  { key: "perro_nombre", label: "Nombre(s)", group: "Perro" },
  { key: "perro_raza", label: "Raza", group: "Perro" },
  { key: "perro_sexo", label: "Sexo", group: "Perro" },
  { key: "perro_color", label: "Color", group: "Perro" },
  { key: "perro_edad", label: "Edad", group: "Perro" },
  { key: "perro_microchip", label: "Microchip", group: "Perro" },

  { key: "servicio", label: "Servicio / plan", group: "Servicio" },
  { key: "servicios_incluidos", label: "Servicios incluidos", group: "Servicio" },
  { key: "sesiones", label: "Sesiones / créditos", group: "Servicio" },
  { key: "valor_total", label: "Valor total", group: "Servicio" },
  { key: "valor_letras", label: "Valor en letras", group: "Servicio" },
  { key: "forma_pago", label: "Forma de pago", group: "Servicio" },
  { key: "observaciones", label: "Observaciones", group: "Servicio" },

  { key: "fecha_inicio", label: "Fecha de inicio", group: "Fechas" },
  { key: "fecha_fin", label: "Fecha de fin", group: "Fechas" },
  { key: "duracion", label: "Duración", group: "Fechas" },
  { key: "fecha_hoy", label: "Fecha de firma", group: "Fechas" },
];

const KNOWN_KEYS = new Set(CONTRACT_VARIABLES.map((v) => v.key));
const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+)\s*\}\}/g;

/** Variables que usa la plantilla y no están en el catálogo: el asistente las pide a mano. */
export function extractCustomVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(VARIABLE_RE)) {
    const key = m[1].toLowerCase();
    if (!KNOWN_KEYS.has(key)) found.add(key);
  }
  return [...found];
}

export function usedVariables(body: string): Set<string> {
  return new Set([...body.matchAll(VARIABLE_RE)].map((m) => m[1].toLowerCase()));
}

export function humanizeKey(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Reemplaza las variables. Las vacías quedan como una línea para llenar a mano. */
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(VARIABLE_RE, (_, raw: string) => {
    const v = values[raw.toLowerCase()]?.trim();
    return v ? v : "________________";
  });
}

// ── Fechas y duración ──────────────────────────────────────────────────────

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return "";
  }
}

/** "5 días" / "3 noches" según el tipo de servicio (los internados cuentan noches). */
export function describeDuration(start: string, end: string, byNights: boolean): string {
  if (!start || !end) return "";
  const days = differenceInCalendarDays(parseISO(end), parseISO(start));
  if (days < 0) return "";
  if (byNights) {
    if (days === 0) return "1 día";
    return `${days} ${days === 1 ? "noche" : "noches"}`;
  }
  const inclusive = days + 1;
  if (inclusive % 30 === 0 && inclusive >= 30) {
    const months = inclusive / 30;
    return `${months} ${months === 1 ? "mes" : "meses"}`;
  }
  return `${inclusive} ${inclusive === 1 ? "día" : "días"}`;
}

export function isOvernightService(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  return /board|internad|hotel|hosped|boarding/i.test(serviceType);
}

export function ageFromBirthDate(birth: string | null | undefined): string {
  if (!birth) return "";
  const months = Math.floor(differenceInCalendarDays(new Date(), parseISO(birth)) / 30.44);
  if (months < 0) return "";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

// ── Número a letras (es) ───────────────────────────────────────────────────

const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
  "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
  "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function below1000(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let restText = "";
  if (rest < 30) restText = UNITS[rest];
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    restText = TENS[t] + (u ? ` y ${UNITS[u]}` : "");
  }
  return [HUNDREDS[h], restText].filter(Boolean).join(" ");
}

/** Apocopa "uno" → "un" antes de "mil"/"millones" y de un sustantivo. */
function apocope(s: string): string {
  return s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

/** 1250000 → "un millón doscientos cincuenta mil". Solo la parte entera. */
export function numberToSpanishWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "cero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (millions) {
    parts.push(millions === 1 ? "un millón" : `${apocope(numberToSpanishWords(millions))} millones`);
  }
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

export function formatContractValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return formatCurrency(value);
}

// ── Render a HTML (vista previa e impresión) ───────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * Convierte el texto de la plantilla ya renderizado a HTML seguro. Los
 * encabezados son líneas sueltas; las demás líneas seguidas forman un párrafo.
 * (Mismas reglas que supabase/functions/_shared/contractPdf.ts.)
 */
export function contractBodyToHtml(text: string): string {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br />")}</p>`);
    para = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("## ")) { flush(); out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("# ")) { flush(); out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else para.push(line);
  }
  flush();
  return out.join("\n");
}

export interface SignatureParty {
  role: string;
  name: string;
  detail?: string;
}

export function signaturesHtml(parties: SignatureParty[]): string {
  const cells = parties
    .map(
      (p) => `<div class="sig">
        <div class="sig-line"></div>
        <div class="sig-name">${escapeHtml(p.name || " ")}</div>
        <div class="sig-role">${escapeHtml(p.role)}${p.detail ? ` · ${escapeHtml(p.detail)}` : ""}</div>
      </div>`
    )
    .join("");
  return `<div class="signatures">${cells}</div>`;
}

/** HTML del documento listo para vista previa o impresión. */
export function buildContractHtml(renderedBody: string, signatures: SignatureParty[] | null): string {
  return contractBodyToHtml(renderedBody) + (signatures ? signaturesHtml(signatures) : "");
}

export const CONTRACT_DOCUMENT_CSS = `
  .contract-doc { font-family: "Georgia", "Times New Roman", serif; font-size: 12pt; line-height: 1.55; color: #111; }
  .contract-doc h1 { font-size: 15pt; text-align: center; text-transform: uppercase; letter-spacing: .02em; margin: 0 0 18pt; }
  .contract-doc h2 { font-size: 12.5pt; margin: 16pt 0 6pt; }
  .contract-doc p { margin: 0 0 10pt; text-align: justify; }
  .contract-doc .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40pt; margin-top: 56pt; break-inside: avoid; }
  .contract-doc .sig-line { border-top: 1px solid #111; margin-bottom: 4pt; height: 0; }
  .contract-doc .sig-name { font-weight: bold; font-size: 11pt; }
  .contract-doc .sig-role { font-size: 10pt; color: #444; }
`;

/** Imprime el documento en un iframe oculto (no depende del layout de la app ni de popups). */
export function printContract(title: string, innerHtml: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: letter; margin: 2.2cm 2.4cm; }
      html, body { margin: 0; background: #fff; }
      ${CONTRACT_DOCUMENT_CSS}
    </style></head>
    <body><div class="contract-doc">${innerHtml}</div></body></html>`);
  doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.contentWindow?.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Safari no siempre dispara afterprint.
    setTimeout(cleanup, 60_000);
  }, 150);
}

// ── Importar plantilla desde archivo ───────────────────────────────────────

export async function readTemplateFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    // Word separa párrafos con un salto; la plantilla usa línea en blanco.
    return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }
  throw new Error("Formato no soportado. Usa un archivo .docx o .txt");
}

// ── Plantillas de ejemplo ──────────────────────────────────────────────────

export interface StarterTemplate {
  id: string;
  name: string;
  serviceHint: string;
  body: string;
}

const PARTIES = `Entre **{{negocio_nombre}}**, con domicilio en {{negocio_direccion}}, {{negocio_ciudad}}, en adelante EL PRESTADOR, y **{{cliente_nombre}}**, identificado(a) con {{cliente_tipo_documento}} No. {{cliente_documento}}, con domicilio en {{cliente_direccion}}, {{cliente_ciudad}}, teléfono {{cliente_telefono}}, en adelante EL PROPIETARIO, se celebra el presente contrato, que se regirá por las siguientes cláusulas:`;

const PET = `## PRIMERA. Mascotas
El servicio se presta a: {{mascotas}}. EL PROPIETARIO declara que cada mascota tiene su esquema de vacunación y desparasitación al día e informará cualquier condición médica o de comportamiento relevante.`;

const CLOSING = `## Datos de emergencia
Contacto de emergencia: {{contacto_emergencia}}.

## Observaciones
{{observaciones}}

Leído y aceptado, se firma en {{negocio_ciudad}}, el {{fecha_hoy}}.`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "daycare",
    name: "Guardería",
    serviceHint: "daycare",
    body: `# Contrato de prestación de servicios de guardería canina

${PARTIES}

${PET}

## SEGUNDA. Objeto
EL PRESTADOR se obliga a prestar el servicio de **{{servicio}}**, que incluye: {{servicios_incluidos}}.

## TERCERA. Vigencia
El presente contrato tiene una duración de {{duracion}}, desde el {{fecha_inicio}} hasta el {{fecha_fin}}, con un total de {{sesiones}} sesiones.

## CUARTA. Valor y forma de pago
El valor total del servicio es de **{{valor_total}}** ({{valor_letras}} pesos), pagadero mediante {{forma_pago}}. Las sesiones no utilizadas dentro de la vigencia no son reembolsables.

## QUINTA. Obligaciones del propietario
Entregar y recoger a las mascotas en los horarios establecidos, informar cambios en su salud o alimentación y responder por los daños que causen a terceros por comportamiento no informado.

${CLOSING}`,
  },
  {
    id: "boarding",
    name: "Paquete internado",
    serviceHint: "board_and_train",
    body: `# Contrato de hospedaje e internado canino

${PARTIES}

${PET}

## SEGUNDA. Objeto
EL PRESTADOR recibirá a las mascotas en sus instalaciones en modalidad de internado, servicio **{{servicio}}**, que incluye: {{servicios_incluidos}}.

## TERCERA. Duración
El internado tendrá una duración de {{duracion}}, con ingreso el {{fecha_inicio}} y salida el {{fecha_fin}}. Las extensiones se cobrarán según la tarifa vigente.

## CUARTA. Valor y forma de pago
El valor total es de **{{valor_total}}** ({{valor_letras}} pesos), pagadero mediante {{forma_pago}}.

## QUINTA. Atención veterinaria
En caso de emergencia, EL PROPIETARIO autoriza a EL PRESTADOR a llevar a la mascota afectada al veterinario más cercano. Los costos de la atención correrán por cuenta de EL PROPIETARIO.

## SEXTA. Recogida
Si las mascotas no son recogidas en la fecha pactada sin aviso previo, se cobrará cada día adicional según la tarifa vigente.

${CLOSING}`,
  },
  {
    id: "home",
    name: "Servicio a domicilio",
    serviceHint: "",
    body: `# Contrato de prestación de servicios a domicilio

${PARTIES}

${PET}

## SEGUNDA. Objeto
EL PRESTADOR prestará el servicio de **{{servicio}}** en el domicilio de EL PROPIETARIO ubicado en {{cliente_direccion}}, {{cliente_ciudad}}. Incluye: {{servicios_incluidos}}.

## TERCERA. Vigencia
Desde el {{fecha_inicio}} hasta el {{fecha_fin}} ({{duracion}}), con un total de {{sesiones}} visitas.

## CUARTA. Valor y forma de pago
El valor total es de **{{valor_total}}** ({{valor_letras}} pesos), pagadero mediante {{forma_pago}}.

## QUINTA. Acceso al domicilio
EL PROPIETARIO garantizará el acceso al inmueble en los horarios pactados. Las visitas que no puedan realizarse por causas atribuibles a EL PROPIETARIO se entenderán prestadas.

${CLOSING}`,
  },
];

/** Firmas estándar: el negocio y el propietario (con su documento si lo hay). */
export function defaultSignatures(values: Record<string, string>): SignatureParty[] {
  return [
    { role: "El prestador", name: values.negocio_nombre ?? "" },
    {
      role: "El propietario",
      name: values.cliente_nombre ?? "",
      detail: values.cliente_documento
        ? `${values.cliente_tipo_documento || "Doc."} ${values.cliente_documento}`
        : undefined,
    },
  ];
}

export interface ContractDog {
  name: string;
  breed?: string | null;
  gender?: string | null;
  color?: string | null;
  birth_date?: string | null;
  microchip_number?: string | null;
}

const GENDER_LABELS: Record<string, string> = { male: "Macho", female: "Hembra" };

function joinNames(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

/**
 * Variables de mascota para uno o varios perros. Con varios, cada perro_*
 * junta los valores ("Luna y Max", "Golden / Beagle") y {{mascotas}} describe
 * a cada uno: "Luna (Golden Retriever, hembra, 3 años) y Max (Beagle, macho)".
 */
export function dogVariables(dogs: ContractDog[]): Record<string, string> {
  const join = (f: (d: ContractDog) => string) => {
    const vals = dogs.map(f);
    return vals.every((v) => !v) ? "" : vals.map((v) => v || "—").join(" / ");
  };
  const describe = (d: ContractDog) => {
    const parts = [
      d.breed,
      d.gender ? (GENDER_LABELS[d.gender] ?? d.gender).toLowerCase() : "",
      d.color,
      ageFromBirthDate(d.birth_date),
      d.microchip_number ? `microchip ${d.microchip_number}` : "",
    ].filter(Boolean);
    return parts.length ? `**${d.name}** (${parts.join(", ")})` : `**${d.name}**`;
  };
  return {
    mascotas: joinNames(dogs.map(describe)),
    perro_nombre: joinNames(dogs.map((d) => d.name)),
    perro_raza: join((d) => d.breed ?? ""),
    perro_sexo: join((d) => (d.gender ? GENDER_LABELS[d.gender] ?? d.gender : "")),
    perro_color: join((d) => d.color ?? ""),
    perro_edad: join((d) => ageFromBirthDate(d.birth_date)),
    perro_microchip: join((d) => d.microchip_number ?? ""),
  };
}

export const CONTRACT_STATUS: Record<
  "generated" | "sent" | "signed" | "void",
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  generated: { label: "Pendiente de firma", variant: "secondary" },
  sent: { label: "Enviado para firma", variant: "outline" },
  signed: { label: "Firmado", variant: "default" },
  void: { label: "Anulado", variant: "outline" },
};
