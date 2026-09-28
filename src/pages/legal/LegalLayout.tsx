import { ReactNode } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { CUSTOMER_AUTHORIZATION_PATH, LEGAL, LEGAL_DOCS, legalConfigPending } from "@/lib/legal";

interface Props {
  title: string;
  updated: string;
  version?: string;
  children: ReactNode;
}

/** Contenedor de páginas legales. Marca slate+amber. */
export function LegalLayout({ title, updated, version, children }: Props) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </a>

        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1b2b4d]">
          <FileText className="h-6 w-6 shrink-0 text-amber-600" />
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Última actualización: {updated}
          {version && <> · Versión {version}</>}
        </p>

        {legalConfigPending() && (
          <div className="mt-6 rounded-lg border border-amber-600/30 bg-amber-600/10 p-4 text-sm text-amber-900 print:hidden">
            <strong>Documento en revisión.</strong> Algunos datos de identificación del
            operador (resaltados) están pendientes de completarse. Para cualquier solicitud
            sobre tus datos personales usa el canal de soporte de la plataforma.
          </div>
        )}

        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700">
          {children}
        </div>

        <nav className="mt-12 border-t border-slate-200 pt-6 text-sm print:hidden" aria-label="Documentos legales">
          <p className="mb-2 font-medium text-slate-600">Documentos legales</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.values(LEGAL_DOCS).map((d) => (
              <li key={d.path}>
                <a href={d.path} className="text-amber-700 underline-offset-2 hover:underline">{d.title}</a>
              </li>
            ))}
            <li>
              <a href={CUSTOMER_AUTHORIZATION_PATH} className="text-amber-700 underline-offset-2 hover:underline">
                Modelo de autorización para clientes
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** Sección con título numerado. */
export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-[#1b2b4d]">
        {n}. {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Muestra un dato de identidad legal; si está pendiente lo resalta. */
export function LegalValue({ value, label }: { value: string | number; label: string }) {
  if (typeof value === "string" && value.startsWith("PENDIENTE")) {
    return <mark className="rounded bg-amber-200/70 px-1 text-amber-900">[{label} pendiente]</mark>;
  }
  return <strong>{value}</strong>;
}

/** Bloque de identificación del operador (Responsable del Tratamiento). */
export function OperatorInfo() {
  return (
    <ul className="list-none space-y-1 rounded-lg border border-slate-200 bg-white p-4">
      <li>Razón social: <LegalValue value={LEGAL.companyName} label="Razón social" /></li>
      <li>NIT: <LegalValue value={LEGAL.nit} label="NIT" /></li>
      <li>Domicilio: <LegalValue value={LEGAL.address} label="Dirección" />, <LegalValue value={LEGAL.city} label="Ciudad" />, Colombia</li>
      <li>Correo para datos personales: <LegalValue value={LEGAL.dataEmail} label="Correo" /></li>
      <li>Teléfono: <LegalValue value={LEGAL.phone} label="Teléfono" /></li>
      <li>Marca comercial: <strong>{LEGAL.brand}</strong></li>
    </ul>
  );
}
