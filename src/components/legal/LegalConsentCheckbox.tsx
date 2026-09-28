import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_DOCS } from "@/lib/legal";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** "account": Términos + Política. "organization": además el Contrato de Transmisión. */
  variant?: "account" | "organization";
  id?: string;
}

const link = "font-medium text-primary underline-offset-2 hover:underline";

/**
 * Casilla de aceptación legal (Ley 1581): nunca viene marcada y los documentos
 * abren en otra pestaña para no perder el formulario.
 */
export function LegalConsentCheckbox({ checked, onCheckedChange, variant = "account", id = "legal-consent" }: Props) {
  const doc = (key: keyof typeof LEGAL_DOCS) => (
    <a href={LEGAL_DOCS[key].path} target="_blank" rel="noopener noreferrer" className={link}>
      {LEGAL_DOCS[key].title}
    </a>
  );
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} className="mt-0.5" required />
      <label htmlFor={id} className="text-sm leading-snug text-muted-foreground">
        Acepto los {doc("terms")} y autorizo el tratamiento de mis datos personales conforme a la{" "}
        {doc("privacy")}
        {variant === "organization" && <> y, en nombre de mi centro, acepto el {doc("data_processing")}</>}.
      </label>
    </div>
  );
}

/** Versiones a enviar al backend como prueba de lo aceptado. */
export const ACCOUNT_CONSENT_VERSIONS = {
  terms: LEGAL_DOCS.terms.version,
  privacy: LEGAL_DOCS.privacy.version,
};
