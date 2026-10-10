import { describe, it, expect } from "vitest";
import { PAGE_CATALOG, firstAllowedPath, roleCanSeePage } from "@/lib/permissions";

describe("secciones por rol", () => {
  const vet = { access_type: "panel" as const, pages: ["dogs", "dog_panel", "clinic", "report_cards", "tasks", "calendar"] as const };

  it("un rol Panel con lista solo ve esas secciones", () => {
    expect(roleCanSeePage({ ...vet, pages: [...vet.pages] }, "clinic")).toBe(true);
    expect(roleCanSeePage({ ...vet, pages: [...vet.pages] }, "invoices")).toBe(false);
    expect(roleCanSeePage({ ...vet, pages: [...vet.pages] }, "customers")).toBe(false);
  });

  it("sin lista, administrador o sin rol: ve todo (como antes)", () => {
    expect(roleCanSeePage({ access_type: "panel", pages: null }, "invoices")).toBe(true);
    expect(roleCanSeePage({ access_type: "admin", pages: ["dogs"] }, "invoices")).toBe(true);
    expect(roleCanSeePage(null, "invoices")).toBe(true);
  });

  it("la página de inicio es la primera sección permitida, en orden del menú", () => {
    expect(firstAllowedPath({ ...vet, pages: [...vet.pages] })).toBe("calendar");
    expect(firstAllowedPath({ access_type: "panel", pages: ["clinic"] })).toBe("clinic");
    expect(firstAllowedPath({ access_type: "panel", pages: null })).toBe("dashboard");
  });

  it("el catálogo coincide con org_page_catalog() de la base", () => {
    expect(PAGE_CATALOG.map((p) => p.key).sort()).toEqual([
      "calendar", "campaigns", "clinic", "contracts", "customers", "dashboard", "dog_panel", "dogs", "facility",
      "invoices", "my_day", "my_route", "my_schedule", "notices", "plans", "report_cards", "reports", "requests",
      "routes", "staff", "tasks",
    ]);
  });

  it("personal operativo: usa el panel con las secciones de Mi día y empieza ahí", () => {
    const worker = { access_type: "worker" as const, pages: null };
    expect(roleCanSeePage(worker, "my_day")).toBe(true);
    expect(roleCanSeePage(worker, "facility")).toBe(true);
    expect(roleCanSeePage(worker, "invoices")).toBe(false);
    expect(firstAllowedPath(worker)).toBe("my-day");
    expect(firstAllowedPath({ access_type: "worker", pages: ["dogs", "facility"] })).toBe("facility");
  });

  it("administrador y oficina no empiezan en Mi día aunque lo vean", () => {
    expect(firstAllowedPath({ access_type: "admin", pages: null })).toBe("dashboard");
    expect(firstAllowedPath({ access_type: "panel", pages: ["my_day", "clinic"] })).toBe("clinic");
  });
});
