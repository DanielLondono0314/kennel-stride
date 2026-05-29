import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Build a reusable mock chain that is both chainable and thenable (Promise-like)
// Mutations use: supabase.from("invoices").update({...}).eq("id", id)
// Queries use: supabase.from("invoices").select(...).eq(...).order(...).range(...)
// The chain object acts as a Promise via .then so `await chain` resolves to { data: [], error: null, count: 0 }

function makeMockChain() {
  const chain: Record<string, any> = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  // All chainable methods return the same chain object
  const chainable = ["select", "update", "insert", "delete", "eq", "order", "range", "limit", "or"];
  chainable.forEach((method) => {
    chain[method].mockReturnValue(chain);
  });

  // Make it thenable so `await chain` resolves
  chain.then.mockImplementation((resolve: (v: any) => void, _reject?: (e: any) => void) => {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, _reject);
  });
  chain.catch.mockImplementation((_handler: (e: any) => void) => {
    return Promise.resolve({ data: [], error: null, count: 0 });
  });

  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => makeMockChain()),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-test" } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-test" } }),
}));

import { useMarkInvoicePaid, useCancelInvoice } from "@/hooks/queries/useInvoices";

describe("useMarkInvoicePaid", () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("el estado es idle antes de llamar", () => {
    const { result } = renderHook(() => useMarkInvoicePaid(), { wrapper });
    expect(result.current.isIdle).toBe(true);
  });

  it("hook expone mutateAsync como función", () => {
    const { result } = renderHook(() => useMarkInvoicePaid(), { wrapper });
    expect(typeof result.current.mutateAsync).toBe("function");
  });

  it("completa sin lanzar error", async () => {
    const { result } = renderHook(() => useMarkInvoicePaid(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ id: "inv-1", method: "cash" });
      })
    ).resolves.not.toThrow();
  });
});

describe("useCancelInvoice", () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("el estado es idle antes de llamar", () => {
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    expect(result.current.isIdle).toBe(true);
  });

  it("completa sin lanzar error", async () => {
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync("inv-1");
      })
    ).resolves.not.toThrow();
  });
});
