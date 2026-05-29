import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,       // 1 min antes de re-fetch en background
        gcTime: 1000 * 60 * 5,      // 5 min en cache sin uso
        retry: 1,                    // 1 reintento en error de red
        refetchOnWindowFocus: false, // kennel app no necesita re-fetch al cambiar tab
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
