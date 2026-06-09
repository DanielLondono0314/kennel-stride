import { ReactNode } from "react";
import { ArrowLeft, FileText } from "lucide-react";

interface Props {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Contenedor de páginas legales (Términos / Privacidad). Marca slate+amber. */
export function LegalLayout({ title, updated, children }: Props) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </a>

        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1b2b4d]">
          <FileText className="h-6 w-6 text-amber-600" />
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Última actualización: {updated}</p>

        {/* Banner honesto: es una plantilla, no asesoría jurídica. */}
        <div className="mt-6 rounded-lg border border-amber-600/30 bg-amber-600/10 p-4 text-sm text-amber-900">
          <strong>Plantilla — revisar antes de operar.</strong> Este texto es una base
          adaptada al stack del producto (Supabase, LemonSqueezy, Resend, Vercel, Sentry).
          Sustituye los campos entre corchetes y revísalo con asesoría legal antes de
          operar comercialmente. No constituye asesoría jurídica.
        </div>

        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Sección con título numerado, para reusar en ambas páginas. */
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
