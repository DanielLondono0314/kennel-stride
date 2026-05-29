import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { usePermission } from "@/hooks/usePermission";

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: vi.fn(),
}));

import { useOrganization } from "@/contexts/OrganizationContext";

function withRole(role: string | null) {
  vi.mocked(useOrganization).mockReturnValue({
    organization: { id: "org-1" } as any,
    currentUserRole: role as any,
    isAdmin: role === "admin",
    loading: false,
    notFound: false,
    loadError: false,
    isSubscriptionActive: true,
    refetch: vi.fn(),
  });
}

describe("usePermission", () => {
  it("admin puede todo", () => {
    withRole("admin");
    const { result } = renderHook(() => usePermission("delete_customer"));
    expect(result.current).toBe(true);
  });

  it("trainer no puede eliminar clientes", () => {
    withRole("trainer");
    const { result } = renderHook(() => usePermission("delete_customer"));
    expect(result.current).toBe(false);
  });

  it("front_desk puede crear facturas", () => {
    withRole("front_desk");
    const { result } = renderHook(() => usePermission("create_invoice"));
    expect(result.current).toBe(true);
  });

  it("trainer no puede ver reportes", () => {
    withRole("trainer");
    const { result } = renderHook(() => usePermission("view_reports"));
    expect(result.current).toBe(false);
  });

  it("sin rol → ningún permiso", () => {
    withRole(null);
    const { result } = renderHook(() => usePermission("create_invoice"));
    expect(result.current).toBe(false);
  });
});
