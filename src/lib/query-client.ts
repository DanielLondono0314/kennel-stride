import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sentry } from "./sentry";

/** Traduce los errores de límite de plan del backend (enforce_plan_limit). */
export function friendlyPlanLimitMessage(message: string): string {
  const match = /plan_limit_(dogs|members):\s*tu plan permite hasta (\d+)/.exec(message);
  if (!match) return message;
  const what = match[1] === "dogs" ? "perros" : "usuarios";
  return `Llegaste al límite de tu plan (${match[2]} ${what}). Mejora tu plan en Facturación para agregar más.`;
}

function extractMessage(error: unknown): string {
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
        if (!mutation.options.onError) {
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
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
