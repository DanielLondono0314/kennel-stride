// Documento de identidad del cliente (customers.id_document / id_document_type).
// Espejo del CHECK de la migración 20260930000000_contracts.

export type IdDocumentType = "CC" | "CE" | "TI" | "PA" | "PPT" | "NIT";

export const ID_DOCUMENT_TYPES: { value: IdDocumentType; label: string; short: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía", short: "C.C." },
  { value: "CE", label: "Cédula de extranjería", short: "C.E." },
  { value: "PPT", label: "Permiso por protección temporal", short: "PPT" },
  { value: "PA", label: "Pasaporte", short: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad", short: "T.I." },
  { value: "NIT", label: "NIT", short: "NIT" },
];

export function idDocumentShort(type: string | null | undefined): string {
  return ID_DOCUMENT_TYPES.find((t) => t.value === type)?.short ?? "Doc.";
}

/** "C.C. 1.020.304.050" */
export function formatIdDocument(type: string | null | undefined, number: string | null | undefined): string {
  if (!number?.trim()) return "";
  return `${idDocumentShort(type)} ${number.trim()}`;
}

/** Error de Postgres por cédula repetida en la org (índice único). */
export function isDuplicateIdDocumentError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "23505" && /id_document/.test(e?.message ?? "");
}
