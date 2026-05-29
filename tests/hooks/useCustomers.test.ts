import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCustomers } from "@/hooks/queries/useCustomers";

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      ...mockSupabaseChain,
      then: undefined,
    })),
  },
}));

// Make the chain thenable (Promise-like) so useQuery can await it
Object.defineProperty(mockSupabaseChain, "then", {
  get() {
    return (resolve: (v: any) => void) =>
      resolve({ data: [], error: null, count: 0 });
  },
});

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

describe("useCustomers", () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  it("retorna datos vacíos cuando la query devuelve []", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.customers).toEqual([]);
    expect(result.current.data?.total).toBe(0);
    expect(result.current.data?.hasMore).toBe(false);
  });

  it("está habilitado cuando hay orgId", () => {
    const { result } = renderHook(() => useCustomers({ page: 0, search: "Ana" }), { wrapper });
    expect(result.current.isLoading || result.current.isSuccess || result.current.isFetching).toBe(true);
  });
});
