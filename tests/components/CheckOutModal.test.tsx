import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckOutModal } from "@/components/checkin/CheckOutModal";

// El check-out debe ser ATÓMICO: una sola llamada al RPC complete_checkout
// (pago + notas + liberación de perrera + completitud en una transacción).
// El cliente NO debe insertar facturas ni actualizar reservas directamente:
// eso era lo que dejaba facturas huérfanas cuando el RPC de completitud fallaba.
const rpcCalls: Array<{ fn: string; args: any }> = [];
const writeCalls: Array<{ table: string; op: string; payload?: any }> = [];
let rpcResult: { data: any; error: any } = { data: { invoice_id: "inv-1" }, error: null };

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
    insert: vi.fn((payload: any) => { writeCalls.push({ table, op: "insert", payload }); return chain; }),
    update: vi.fn((payload: any) => { writeCalls.push({ table, op: "update", payload }); return chain; }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => makeChain(table)),
    rpc: vi.fn((fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    }),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
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

describe("CheckOutModal — check-out atómico vía complete_checkout", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    writeCalls.length = 0;
    rpcResult = { data: { invoice_id: "inv-1" }, error: null };
    vi.clearAllMocks();
  });

  it("al confirmar (efectivo) hace UNA llamada a complete_checkout y nada más", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CheckOutModal reservation={reservation} open onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    fireEvent.click(await screen.findByRole("button", { name: /confirmar check-out/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reservationId: "res-1" }));

    const checkoutCalls = rpcCalls.filter((c) => c.fn === "complete_checkout");
    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0].args).toMatchObject({
      p_reservation_id: "res-1",
      p_payment_method: "cash",
    });

    // Invariante: el cliente no escribe facturas ni reservas directamente.
    expect(writeCalls.filter((c) => c.table === "invoices")).toHaveLength(0);
    expect(writeCalls.filter((c) => c.table === "invoice_items")).toHaveLength(0);
    expect(writeCalls.filter((c) => c.table === "reservations")).toHaveLength(0);
  });

  it("si el RPC falla, NO llama onConfirm (no hay estado a medias que ocultar)", async () => {
    rpcResult = { data: null, error: { message: "Reserva inválida, fuera de tu organización o no está en curso" } };
    const onConfirm = vi.fn();
    render(
      <CheckOutModal reservation={reservation} open onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    fireEvent.click(await screen.findByRole("button", { name: /confirmar check-out/i }));

    await waitFor(() =>
      expect(rpcCalls.filter((c) => c.fn === "complete_checkout")).toHaveLength(1)
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("envía las notas al RPC en vez de actualizarlas por su cuenta", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CheckOutModal reservation={reservation} open onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    fireEvent.change(screen.getByLabelText(/notas de check-out/i), {
      target: { value: "Se portó excelente" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /confirmar check-out/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());

    expect(rpcCalls[0].args).toMatchObject({ p_notes: "Se portó excelente" });
    expect(writeCalls.filter((c) => c.table === "reservations")).toHaveLength(0);
  });
});
