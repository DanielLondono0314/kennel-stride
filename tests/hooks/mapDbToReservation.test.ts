import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organization: null }) }));

describe("mapDbToReservation — location", () => {
  const base: any = {
    id: "r1", customer_id: "c1", dog_id: "d1", staff_id: null, location_id: "u1",
    service_type: "daycare", service_name: "Guardería", status: "checked_in",
    start_date: "2026-06-10T09:00:00Z", end_date: "2026-06-10T17:00:00Z",
    check_in_time: null, check_out_time: null, total_price: 0, notes: null,
    rejection_reason: null, created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
    customers: null, dogs: null, staff_members: null,
  };

  it("mapea la perrera embebida a location", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const r = mapDbToReservation({ ...base, location: { id: "u1", name: "A-1", unit_type: "kennel" } });
    expect(r.location).toEqual({ id: "u1", name: "A-1", type: "kennel", capacity: 1, isActive: true });
    expect(r.locationId).toBe("u1");
  });

  it("deja location undefined cuando no hay perrera", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const r = mapDbToReservation({ ...base, location_id: null, location: null });
    expect(r.location).toBeUndefined();
  });
});
