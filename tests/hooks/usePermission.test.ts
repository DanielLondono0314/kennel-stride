import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import type { OrgRoleInfo } from "@/lib/permissions";

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: vi.fn(),
}));

import { useOrganization } from "@/contexts/OrganizationContext";

function withRole(role: Partial<OrgRoleInfo> | null) {
  const currentRole = role
    ? ({ id: "r-1", name: "Rol", access_type: "panel", permissions: [], is_system: false, system_key: null, ...role } as OrgRoleInfo)
    : null;
  vi.mocked(useOrganization).mockReturnValue({
    organization: { id: "org-1" } as any,
    currentUserRole: null,
    currentRole,
    isAdmin: currentRole?.access_type === "admin",
    loading: false,
    notFound: false,
    loadError: false,
    isSubscriptionActive: true,
    planTier: "premium",
    hasFeature: () => true,
    refetch: vi.fn(),
  });
}

describe("usePermission", () => {
  it("tipo admin puede todo, aunque no tenga casillas", () => {
    withRole({ access_type: "admin", permissions: [] });
    expect(renderHook(() => usePermission("delete_records")).result.current).toBe(true);
    expect(renderHook(() => usePermission("manage_settings")).result.current).toBe(true);
  });

  it("rol de panel solo tiene sus casillas", () => {
    withRole({ access_type: "panel", permissions: ["schedule", "billing"] });
    expect(renderHook(() => usePermission("billing")).result.current).toBe(true);
    expect(renderHook(() => usePermission("view_reports")).result.current).toBe(false);
  });

  it("personal y configuración son exclusivos del tipo admin", () => {
    withRole({ access_type: "panel", permissions: ["schedule", "billing", "view_reports", "send_campaign"] });
    expect(renderHook(() => usePermission("manage_staff")).result.current).toBe(false);
    expect(renderHook(() => usePermission("manage_settings")).result.current).toBe(false);
  });

  it("worker con registro de peso", () => {
    withRole({ access_type: "worker", permissions: ["record_weight"] });
    expect(renderHook(() => usePermission("record_weight")).result.current).toBe(true);
    expect(renderHook(() => usePermission("clinical")).result.current).toBe(false);
  });

  it("sin rol → ningún permiso", () => {
    withRole(null);
    expect(renderHook(() => usePermission("billing")).result.current).toBe(false);
  });
});
