import { describe, it, expect } from "vitest";
import { postLoginPath, SELECT_ORG_PATH } from "@/lib/orgNavigation";
import {
  locationLabel,
  orderByLocation,
  ownedPrincipal,
  toMyOrganization,
  type MembershipRow,
  type MyOrganization,
} from "@/lib/myOrganizations";
import { PLANS, planHasFeature } from "@/lib/plans";
import { ORG_SLUG_PATTERN, toOrgSlug } from "@/lib/orgSlug";

const ME = "user-1";

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
  const org = { id: "o1", slug: "spa-norte", name: "Spa Norte", logo_url: null, parent_org_id: null, owner_id: ME };
  const row = (over: Partial<MembershipRow>): MembershipRow => ({ role: "admin", org_roles: null, organizations: org, ...over });

  it("usa el rol personalizado y su tipo de acceso", () => {
    const o = toMyOrganization(row({ org_roles: { name: "Paseador", access_type: "worker" } }), ME);
    expect(o).toMatchObject({ slug: "spa-norte", roleName: "Paseador", isWorker: true, isOwner: true, parentOrgId: null });
  });

  it("sin rol personalizado cae al rol de sistema", () => {
    const o = toMyOrganization(row({ role: "worker" }), ME);
    expect(o?.roleName).toBe("Trabajador");
    expect(o?.isWorker).toBe(true);
  });

  it("solo es dueño quien creó el centro", () => {
    expect(toMyOrganization(row({}), "otro-usuario")?.isOwner).toBe(false);
  });

  it("descarta membresías sin organización visible", () => {
    expect(toMyOrganization(row({ organizations: null }), ME)).toBeNull();
  });
});

describe("sedes en el selector", () => {
  const mk = (id: string, name: string, parentOrgId: string | null = null, isOwner = true): MyOrganization => ({
    id, slug: id, name, logoUrl: null, parentOrgId, isOwner, roleName: "Administrador", isWorker: false,
  });
  const principal = mk("p", "Huellitas");
  const sur = mk("s2", "Huellitas Sur", "p");
  const norte = mk("s1", "Huellitas Norte", "p");
  const freelance = mk("f", "Agility Club", null, false);

  it("cada principal va seguida de sus sedes", () => {
    expect(orderByLocation([sur, freelance, norte, principal]).map((o) => o.id)).toEqual(["f", "p", "s1", "s2"]);
  });

  it("una sede sin su principal visible queda suelta", () => {
    // Sin "Huellitas" en la lista, "Huellitas Sur" se ordena como un centro más.
    expect(orderByLocation([sur, freelance]).map((o) => o.id)).toEqual(["f", "s2"]);
  });

  it("etiqueta principal y sedes; un centro sin sedes no lleva etiqueta", () => {
    const all = [principal, norte, freelance];
    expect(locationLabel(principal, all)).toBe("Sede principal");
    expect(locationLabel(norte, all)).toBe("Sede");
    expect(locationLabel(freelance, all)).toBeNull();
  });

  it("las sedes se crean desde la principal propia, no desde un centro ajeno", () => {
    expect(ownedPrincipal([freelance, norte, principal])?.id).toBe("p");
    expect(ownedPrincipal([freelance])).toBeNull();
  });
});

describe("multi-sede en los planes", () => {
  it("solo Premium incluye sedes, con el mismo cupo que plan_catalog", () => {
    expect(planHasFeature("premium", "locations")).toBe(true);
    expect(planHasFeature("pro", "locations")).toBe(false);
    expect(PLANS.premium.maxLocations).toBe(5);
    expect(PLANS.pro.maxLocations).toBe(1);
  });
});

describe("toOrgSlug", () => {
  it("genera un slug válido para el servidor", () => {
    expect(toOrgSlug("Huellitas Norte – Sede Ñ")).toBe("huellitas-norte-sede-n");
    expect(ORG_SLUG_PATTERN.test(toOrgSlug("Huellitas Norte"))).toBe(true);
  });
});
