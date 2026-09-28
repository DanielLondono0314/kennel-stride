import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sentry } from "./sentry";

/**
 * Solo vale la pena reintentar fallas transitorias (red, servidor ocupado).
 * Un error de datos — id mal formado, permiso, restricción — va a fallar igual
 * y cada reintento es otra petición 400 (QA E-14).
 */
function isTransientError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || code === "") return true; // red / desconocido
  if (code.startsWith("PGRST")) return false;
  // SQLSTATE: clases 08 (conexión), 53 (recursos), 57 (operador) y 58 (sistema) son transitorias.
  if (/^[0-9A-Z]{5}$/.test(code)) return ["08", "53", "57", "58"].includes(code.slice(0, 2));
  return true;
}

/** Traduce los errores de límite de plan del backend (enforce_plan_limit). */
export function friendlyPlanLimitMessage(message: string): string {
  const match = /plan_limit_(dogs|members):\s*tu plan permite hasta (\d+)/.exec(message);
  if (!match) return message;
  const what = match[1] === "dogs" ? "perros" : "usuarios";
  return `Llegaste al límite de tu plan (${match[2]} ${what}). Mejora tu plan en Facturación para agregar más.`;
}

// Errores de Postgres que el usuario puede provocar: mensaje en español en vez
// del texto técnico ("duplicate key value violates unique constraint…") — QA E-08.
const FRIENDLY_PG_ERRORS: Record<string, string> = {
  "23505": "Ya existe un registro con esos datos.",
  "23503": "No se puede completar: hay registros relacionados.",
  "23502": "Falta un dato obligatorio.",
  "23514": "Algún dato no es válido.",
  "22P02": "Algún dato tiene un formato inválido.",
  "42501": "No tienes permiso para hacer esto.",
};

export function extractMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && FRIENDLY_PG_ERRORS[code]) {
    console.warn("[db]", error); // el detalle técnico queda en consola
    return FRIENDLY_PG_ERRORS[code];
  }
  if (error instanceof Error) return friendlyPlanLimitMessage(error.message);
  if (typeof error === "string") return friendlyPlanLimitMessage(error);
  // PostgrestError puede llegar como objeto plano con `message`.
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return friendlyPlanLimitMessage(error.message);
  }
  return "Error de conexión. Verifica tu red e intenta de nuevo.";
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        Sentry.captureException(error);
        // Toast solo si la query ya tenía datos (error en background refetch)
        // Queries sin datos previos muestran su propio estado de error inline
        if (query.state.data !== undefined) {
          toast.error("Error al actualizar datos", {
            description: extractMessage(error),
          });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        Sentry.captureException(error);
        // Toast solo si la mutation no tiene onError propio (evitar doble toast)
        // Las mutaciones que muestran su propio aviso lo declaran en meta,
        // para no sumar un segundo toast con el error técnico (QA E-08).
        if (!mutation.options.onError && !mutation.meta?.handlesErrors) {
          toast.error("Error al guardar", {
            description: extractMessage(error),
          });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
        retry: (failureCount, error) => failureCount < 1 && isTransientError(error),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
