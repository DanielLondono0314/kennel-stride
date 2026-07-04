import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const rpcMock = vi.fn();

const channelStub = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: vi.fn(() => {
      // Proxy que reenvía cualquier método desconocido a sí mismo para soportar
      // cualquier combinación de métodos encadenados del query builder de Supabase.
      const queryChain: Record<string, unknown> = {};
      const handler = {
        get(_target: unknown, prop: string) {
          if (prop === "then" || prop === "catch" || prop === "finally") {
            // Hace que la cadena sea thenable: resuelve con datos vacíos.
            return (resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null });
          }
          return (..._args: unknown[]) => new Proxy(queryChain, handler);
        },
      };
      return new Proxy(queryChain, handler);
    }),
    channel: vi.fn(() => channelStub),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

describe("useReservations check-in / check-out", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("checkIn llama al RPC check_in_reservation con reserva, perrera y notas", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    await result.current.checkIn("res-1", "unit-9", "ok");

    expect(rpcMock).toHaveBeenCalledWith("check_in_reservation", {
      p_reservation_id: "res-1",
      p_unit_id: "unit-9",
      p_notes: "ok",
    });
  });

  it("checkIn envía p_notes vacío cuando no se pasan notas", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    await result.current.checkIn("res-1", "unit-9");

    expect(rpcMock).toHaveBeenCalledWith("check_in_reservation", {
      p_reservation_id: "res-1",
      p_unit_id: "unit-9",
      p_notes: "",
    });
  });

  // El check-out ya no vive en este hook: lo hace CheckOutModal vía el RPC
  // atómico complete_checkout (ver tests/components/CheckOutModal.test.tsx).
  it("el hook ya no expone checkOut (flujo movido al RPC atómico)", async () => {
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    expect((result.current as Record<string, unknown>).checkOut).toBeUndefined();
  });
});
