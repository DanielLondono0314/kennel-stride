import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useUrlState } from "@/hooks/useUrlState";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(MemoryRouter, { initialEntries: ["/"] }, children);
}

describe("useUrlState", () => {
  it("retorna defaultValue cuando el param no existe", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    expect(result.current[0]).toBe("expected");
  });

  it("actualiza el valor al llamar al setter", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    act(() => result.current[1]("checked-in"));
    expect(result.current[0]).toBe("checked-in");
  });

  it("elimina el param cuando el valor vuelve al default", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    act(() => result.current[1]("checked-in"));
    act(() => result.current[1]("expected"));
    expect(result.current[0]).toBe("expected");
  });
});
