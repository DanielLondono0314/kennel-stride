import { CUSTOMER_AUTHORIZATION_PATH, LEGAL_DOCS } from "@/lib/legal";

/** Enlaces a los documentos legales (pie de login/registro y Mi perfil). */
export function LegalLinks({ includeCustomerModel = false, className = "" }: { includeCustomerModel?: boolean; className?: string }) {
  const links = [
    { label: "Términos", href: LEGAL_DOCS.terms.path },
    { label: "Tratamiento de datos", href: LEGAL_DOCS.privacy.path },
    { label: "Transmisión de datos", href: LEGAL_DOCS.data_processing.path },
    { label: "Cookies", href: LEGAL_DOCS.cookies.path },
    ...(includeCustomerModel ? [{ label: "Modelo de autorización para clientes", href: CUSTOMER_AUTHORIZATION_PATH }] : []),
  ];
  return (
    <nav aria-label="Documentos legales" className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${className}`}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
          {l.label}
        </a>
      ))}
    </nav>
  );
}
