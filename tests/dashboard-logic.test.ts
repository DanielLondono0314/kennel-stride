import { describe, it, expect, vi } from "vitest";

describe("handleCheckOutConfirm", () => {
  it("llama a checkOut con el id correcto", async () => {
    const checkOut = vi.fn().mockResolvedValue({ error: null });
    const setOpen = vi.fn();
    const setSelected = vi.fn();

    async function handleCheckOutConfirm(
      data: { reservationId: string },
      deps: { checkOut: typeof checkOut; setOpen: typeof setOpen; setSelected: typeof setSelected }
    ) {
      const { error } = await deps.checkOut(data.reservationId);
      deps.setOpen(false);
      deps.setSelected(null);
      return { error };
    }

    await handleCheckOutConfirm(
      { reservationId: "res-1" },
      { checkOut, setOpen, setSelected }
    );

    expect(checkOut).toHaveBeenCalledWith("res-1");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(setSelected).toHaveBeenCalledWith(null);
  });
});
