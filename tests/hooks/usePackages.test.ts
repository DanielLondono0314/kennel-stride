/**
 * Stream A — Integridad de créditos
 * Tests para el descuento atómico de créditos vía RPC `deduct_package_credit`.
 *
 * NOTA: `vitest.config.ts` solo incluye `tests/test-suite.ts` en su glob `include`.
 * Para correr este archivo de forma aislada:
 *   npx vitest run tests/hooks/usePackages.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente de Supabase: capturamos rpc y from para verificar el path usado.
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe("deductPackageCredit", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it("llama al RPC deduct_package_credit con el packageId y reason, sin tocar .from('packages')", async () => {
    rpcMock.mockResolvedValue({ data: 4, error: null });
    const { deductPackageCredit } = await import("@/hooks/queries/usePackages");

    await deductPackageCredit({ packageId: "pkg-1", reason: "check-out" });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("deduct_package_credit", {
      p_package_id: "pkg-1",
      p_reason: "check-out",
    });
    // No debe escribir remaining_credits directamente (ni cualquier tabla).
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("envía p_reason = null cuando no se provee reason", async () => {
    rpcMock.mockResolvedValue({ data: 0, error: null });
    const { deductPackageCredit } = await import("@/hooks/queries/usePackages");

    await deductPackageCredit({ packageId: "pkg-2" });

    expect(rpcMock).toHaveBeenCalledWith("deduct_package_credit", {
      p_package_id: "pkg-2",
      p_reason: null,
    });
  });

  it("propaga el error del RPC en la ruta de fallo (créditos agotados por carrera)", async () => {
    const rpcError = { message: "Sin créditos disponibles o paquete inválido" };
    rpcMock.mockResolvedValue({ data: null, error: rpcError });
    const { deductPackageCredit } = await import("@/hooks/queries/usePackages");

    await expect(
      deductPackageCredit({ packageId: "pkg-3" })
    ).rejects.toBe(rpcError);

    expect(fromMock).not.toHaveBeenCalled();
  });
});
