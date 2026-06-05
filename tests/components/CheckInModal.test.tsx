import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckInModal } from "@/components/checkin/CheckInModal";

// Sin perreras disponibles → el selector queda vacío y Confirmar deshabilitado.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

// Validación sin alertas bloqueantes para aislar la regla de la perrera.
vi.mock("@/lib/validations", () => ({
  validateCheckIn: () => ({ isValid: true, canOverride: false, alerts: [] }),
}));

const reservation: any = {
  id: "res-1",
  startDate: new Date("2026-06-10T09:00:00Z"),
  endDate: new Date("2026-06-10T17:00:00Z"),
  status: "scheduled",
  dog: { name: "Max", breed: "Labrador" },
  customer: { firstName: "María", lastName: "G", phone: "555" },
  service: { name: "Guardería" },
};

describe("CheckInModal — regla de perrera", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deshabilita 'Confirmar Check-in' cuando no hay perrera elegida", async () => {
    render(
      <CheckInModal
        reservation={reservation}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    );
    const confirm = await screen.findByRole("button", { name: /confirmar check-in/i });
    expect(confirm).toBeDisabled();
  });
});
