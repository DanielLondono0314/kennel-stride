import type { z } from "zod";

/**
 * Aplana los issues de zod a un mapa campo → primer mensaje.
 * Para paths anidados usa el primer segmento (suficiente para formularios planos).
 */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Enfoca y centra el primer control marcado con aria-invalid="true".
 * Se difiere un frame para que React pinte los errores (y el cambio de tab)
 * antes de buscar el elemento.
 */
export function focusFirstInvalid(root?: HTMLElement | null) {
  requestAnimationFrame(() => {
    const scope: ParentNode = root ?? document;
    const el = scope.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  });
}
