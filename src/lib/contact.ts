/**
 * Teléfonos y enlaces de contacto directo (QA E-17, E-32). Había teléfonos
 * guardados con y sin +57; al guardar se normalizan a E.164 (+57XXXXXXXXXX)
 * cuando el número es colombiano reconocible.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  // Colombia: todo número nacional tiene 10 dígitos (celular 3xx, fijo 60x).
  if (digits.length === 10 && /^(3|60)/.test(digits)) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  return null; // no se reconoce: se deja como lo escribió el usuario
}

/** Teléfono para guardar: E.164 si se reconoce, si no tal como se escribió. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return phone ?? null;
  return toE164(phone) ?? phone.trim();
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return `tel:${toE164(phone) ?? phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(phone: string | null | undefined): string | null {
  const e164 = toE164(phone);
  return e164 ? `https://wa.me/${e164.slice(1)}` : null;
}
