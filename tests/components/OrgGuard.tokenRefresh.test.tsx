import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Al volver a la pestaña, Supabase renueva el token y entrega un objeto `user`
// nuevo (mismo usuario). Antes eso recargaba la org, OrgGuard mostraba el
// spinner y desmontaba la página: el asistente de contratos perdía su avance.

const mocks = vi.hoisted(() => ({
  orgQueries: 0,
  AuthCtx: null as unknown as React.Context<{ user: { id: string } | null }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => {
        if (table === "organizations") {
          mocks.orgQueries++;
          return {
            data: {
              id: "org-1", slug: "org-a", name: "Org A", subscription_status: "active",
              plan_tier: "premium", trial_ends_at: "2099-01-01", service_types: [],
            },
            error: null,
          };
        }
        return { data: { role: "admin", org_roles: { id: "r", name: "Admin", access_type: "admin", permissions: [], is_system: true, system_key: "admin" } }, error: null };
      },
    };
    return q;
  };
  return { supabase: { from: (t: string) => chain(t), rpc: async () => ({ data: false, error: null }) } };
});

vi.mock("@/contexts/AuthContext", async () => {
  const react = await import("react");
  mocks.AuthCtx = react.createContext<{ user: { id: string } | null }>({ user: null });
  return {
    useAuth: () => ({ ...react.useContext(mocks.AuthCtx), session: {}, loading: false }),
  };
});

import { OrgGuard } from "@/components/auth/OrgGuard";

let mounts = 0;
function Page() {
  const [step, setStep] = useState(0);
  useEffect(() => { mounts++; }, []);
  return <button onClick={() => setStep((s) => s + 1)}>paso {step}</button>;
}

let setUser: (u: { id: string }) => void = () => {};
function Harness() {
  const [user, _setUser] = useState({ id: "u1" });
  setUser = _setUser;
  const Ctx = mocks.AuthCtx;
  return (
    <Ctx.Provider value={{ user }}>
      <MemoryRouter initialEntries={["/org-a/page"]}>
        <Routes>
          <Route path="/:orgSlug" element={<OrgGuard />}>
            <Route path="page" element={<Page />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Ctx.Provider>
  );
}

describe("OrgGuard — renovación de token", () => {
  beforeEach(() => { mounts = 0; mocks.orgQueries = 0; });

  it("no desmonta la página ni recarga la org cuando llega un user nuevo con el mismo id", async () => {
    render(<Harness />);
    const btn = await screen.findByRole("button", { name: "paso 0" });
    act(() => btn.click());
    expect(screen.getByRole("button", { name: "paso 1" })).toBeTruthy();

    // TOKEN_REFRESHED: mismo usuario, objeto nuevo.
    act(() => setUser({ id: "u1" }));
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByRole("button", { name: "paso 1" })).toBeTruthy();
    expect(mounts).toBe(1);
    expect(mocks.orgQueries).toBe(1);
  });

  it("sí recarga cuando cambia el usuario", async () => {
    render(<Harness />);
    await screen.findByRole("button", { name: "paso 0" });
    act(() => setUser({ id: "u2" }));
    await waitFor(() => expect(mocks.orgQueries).toBe(2));
  });
});
