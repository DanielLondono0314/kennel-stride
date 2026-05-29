import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sentry } from "./sentry";

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
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
