import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("incluye el unitId elegido en el payload de onConfirm", async () => {
    // Un solo unit disponible.
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.from as any).mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [{ id: "unit-1", name: "A-1" }], error: null }) }),
          order: () => Promise.resolve({ data: [{ id: "zone-1", name: "Interior" }], error: null }),
        }),
      }),
    }));

    const onConfirm = vi.fn();
    render(
      <CheckInModal reservation={reservation} open={true} onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    // Abrir el selector y elegir la perrera A-1.
    const trigger = await screen.findByRole("combobox");
    fireEvent.click(trigger);
    const option = await screen.findByText("A-1");
    fireEvent.click(option);

    const confirm = await screen.findByRole("button", { name: /confirmar check-in/i });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ unitId: "unit-1" }));
  });
});
