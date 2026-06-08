import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckOutModal } from "@/components/checkin/CheckOutModal";

// Mock de supabase que registra los update() para verificar el invariante:
// el modal NO debe poner la reserva en 'completed' (eso lo hace el RPC).
const updateCalls: Array<{ table: string; payload: any }> = [];

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: { id: "inv-1" }, error: null })),
    insert: vi.fn(() => chain),
    update: vi.fn((payload: any) => { updateCalls.push({ table, payload }); return chain; }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn((table: string) => makeChain(table)) },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

vi.mock("@/hooks/queries/usePackages", () => ({
  deductPackageCredit: vi.fn().mockResolvedValue({ error: null }),
}));

const reservation: any = {
  id: "res-1",
  startDate: new Date("2026-06-10T09:00:00Z"),
  endDate: new Date("2026-06-10T17:00:00Z"),
  status: "checked_in",
  totalPrice: 100,
  notes: "",
  dog: { name: "Max", breed: "Labrador" },
  customer: { id: "cust-1", firstName: "María", lastName: "G", phone: "555" },
  service: { name: "Guardería" },
};

describe("CheckOutModal — no completa la reserva por su cuenta", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    vi.clearAllMocks();
  });

  it("al confirmar (efectivo) NO actualiza la reserva a 'completed' y delega en onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CheckOutModal reservation={reservation} open onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    fireEvent.click(await screen.findByRole("button", { name: /confirmar check-out/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reservationId: "res-1" }));

    // Invariante crítico: ningún update marca la reserva como completed.
    const completedUpdate = updateCalls.find(
      (c) => c.table === "reservations" && c.payload?.status === "completed"
    );
    expect(completedUpdate).toBeUndefined();
  });
});
