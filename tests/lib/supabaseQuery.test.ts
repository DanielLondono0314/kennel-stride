import { describe, it, expect, vi } from "vitest";
import { fetchAll, ilikeAny } from "@/lib/supabaseQuery";
import { friendlyPlanLimitMessage } from "@/lib/query-client";

describe("ilikeAny", () => {
  it("entrecomilla el término para que comas y paréntesis no rompan el filtro", () => {
    expect(ilikeAny(["first_name", "last_name"], "Pérez, Juan (hijo)")).toBe(
      'first_name.ilike."%Pérez, Juan (hijo)%",last_name.ilike."%Pérez, Juan (hijo)%"'
    );
  });

  it("escapa comillas dobles y barras invertidas", () => {
    expect(ilikeAny(["name"], ' a"b\\c ')).toBe('name.ilike."%a\\"b\\\\c%"');
  });
});

describe("fetchAll", () => {
  it("pagina de 1000 en 1000 hasta una página incompleta", async () => {
    const total = 2500;
    const page = vi.fn(async (from: number, to: number) => {
      const rows = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
      return { data: rows, error: null };
    });
    const rows = await fetchAll(page);
    expect(rows).toHaveLength(total);
    expect(page).toHaveBeenCalledTimes(3);
    expect(page).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("propaga el error de cualquier página", async () => {
    const err = { message: "boom" };
    await expect(fetchAll(async () => ({ data: null, error: err }))).rejects.toBe(err);
  });
});

describe("friendlyPlanLimitMessage", () => {
  it("traduce el límite de perros", () => {
    expect(friendlyPlanLimitMessage("plan_limit_dogs: tu plan permite hasta 200 perros")).toBe(
      "Llegaste al límite de tu plan (200 perros). Mejora tu plan en Facturación para agregar más."
    );
  });

  it("traduce el límite de usuarios", () => {
    expect(friendlyPlanLimitMessage("plan_limit_members: tu plan permite hasta 2 usuarios")).toContain("2 usuarios");
  });

  it("deja intactos los demás mensajes", () => {
    expect(friendlyPlanLimitMessage("Otro error")).toBe("Otro error");
  });
});
