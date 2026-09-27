import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CONTRACT_DOCUMENT_CSS } from "@/lib/contracts";

interface ContractDocumentProps {
  html: string;
  className?: string;
}

/**
 * Hoja tamaño carta con el contrato renderizado. Siempre fondo blanco y texto
 * negro (es lo que sale impreso), también en modo oscuro.
 */
export function ContractDocument({ html, className }: ContractDocumentProps) {
  const markup = useMemo(() => ({ __html: html }), [html]);
  return (
    <div className={cn("rounded-lg border bg-white shadow-sm", className)}>
      <style>{CONTRACT_DOCUMENT_CSS}</style>
      <div
        className="contract-doc mx-auto max-w-[8.5in] px-6 py-8 sm:px-14 sm:py-12"
        // El HTML sale de contractBodyToHtml, que escapa todo el texto.
        dangerouslySetInnerHTML={markup}
      />
    </div>
  );
}
