import { describe, it, expect } from "vitest";
import { postLoginPath, SELECT_ORG_PATH } from "@/lib/orgNavigation";
import { toMyOrganization } from "@/lib/myOrganizations";

describe("postLoginPath", () => {
  it("sin centros manda a crear uno", () => {
    expect(postLoginPath([])).toBe("/onboarding");
  });

  it("con un centro entra directo (RoleHome decide la vista)", () => {
    expect(postLoginPath(["spa-norte"])).toBe("/spa-norte");
  });

  it("con varios centros manda a elegir", () => {
    expect(postLoginPath(["spa-norte", "spa-sur"])).toBe(SELECT_ORG_PATH);
  });
});

describe("toMyOrganization", () => {
  const org = { slug: "spa-norte", name: "Spa Norte", logo_url: null };

  it("usa el rol personalizado y su tipo de acceso", () => {
    const o = toMyOrganization({ role: "admin", org_roles: { name: "Paseador", access_type: "worker" }, organizations: org });
    expect(o).toEqual({ slug: "spa-norte", name: "Spa Norte", logoUrl: null, roleName: "Paseador", isWorker: true });
  });

  it("sin rol personalizado cae al rol de sistema", () => {
    const o = toMyOrganization({ role: "worker", org_roles: null, organizations: org });
    expect(o?.roleName).toBe("Trabajador");
    expect(o?.isWorker).toBe(true);
  });

  it("descarta membresías sin organización visible", () => {
    expect(toMyOrganization({ role: "admin", org_roles: null, organizations: null })).toBeNull();
  });
});
