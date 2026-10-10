import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import type { OrgRoleInfo } from "@/lib/permissions";

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: vi.fn(),
}));
vi.mock("@/hooks/useMyStaffMember", () => ({
  useMyStaffMember: vi.fn(() => ({ data: null })),
}));

import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";

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
    expect(renderHook(() => usePermission("dogs.delete")).result.current).toBe(true);
    expect(renderHook(() => usePermission("manage_settings")).result.current).toBe(true);
  });

  it("rol de oficina solo tiene sus casillas", () => {
    withRole({ access_type: "panel", permissions: ["reservations.create", "invoices.create"] });
    expect(renderHook(() => usePermission("invoices.create")).result.current).toBe(true);
    expect(renderHook(() => usePermission("invoices.cancel")).result.current).toBe(false);
    expect(renderHook(() => usePermission("reports.view")).result.current).toBe(false);
  });

  it("mover perros entre perreras no da check-in ni check-out", () => {
    withRole({ access_type: "worker", permissions: ["kennels.move"] });
    expect(renderHook(() => usePermission("kennels.move")).result.current).toBe(true);
    expect(renderHook(() => usePermission("stays.checkin")).result.current).toBe(false);
    expect(renderHook(() => usePermission("stays.checkout")).result.current).toBe(false);
  });

  it("personal y configuración son exclusivos del tipo admin", () => {
    withRole({ access_type: "panel", permissions: ["reservations.create", "invoices.create", "reports.view", "campaigns.send"] });
    expect(renderHook(() => usePermission("manage_staff")).result.current).toBe(false);
    expect(renderHook(() => usePermission("manage_settings")).result.current).toBe(false);
  });

  it("la especialidad veterinaria da la clínica aunque el rol no la tenga", () => {
    withRole({ access_type: "worker", permissions: ["weight.record"] });
    expect(renderHook(() => usePermission("clinical.edit")).result.current).toBe(false);
    vi.mocked(useMyStaffMember).mockReturnValue({ data: { specialty: "vet" } } as any);
    expect(renderHook(() => usePermission("clinical.edit")).result.current).toBe(true);
    expect(renderHook(() => usePermission("invoices.create")).result.current).toBe(false);
    vi.mocked(useMyStaffMember).mockReturnValue({ data: null } as any);
  });

  it("sin rol → ningún permiso", () => {
    withRole(null);
    expect(renderHook(() => usePermission("invoices.create")).result.current).toBe(false);
  });
});
