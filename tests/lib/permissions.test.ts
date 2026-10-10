import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PERMISSION_CATALOG,
  PERMISSION_IMPLIES,
  permissionRequiredBy,
  reservationStatusPermission,
  roleHasPermission,
  withImpliedPermissions,
} from "@/lib/permissions";

// La migración es la fuente de verdad del servidor: el frontend debe ser su espejo.
const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261017000000_granular_permissions.sql"), "utf8");

function sqlCatalog(): string[] {
  const body = sql.slice(sql.indexOf("FUNCTION public.org_permission_catalog()"));
  const array = body.slice(body.indexOf("ARRAY["), body.indexOf("]::text[]"));
  return [...array.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]);
}

function sqlImplications(): [string, string][] {
  const body = sql.slice(sql.indexOf("FUNCTION public.org_permission_implied"));
  const values = body.slice(body.indexOf("(VALUES"), body.indexOf("closure(p)"));
  return [...values.matchAll(/\('([a-z_.]+)', '([a-z_.]+)'\)/g)].map((m) => [m[1], m[2]]);
}

describe("catálogo de permisos detallados", () => {
  it("coincide con org_permission_catalog() de la base", () => {
    expect(PERMISSION_CATALOG.map((p) => p.key).sort()).toEqual(sqlCatalog().sort());
  });

  it("los implícitos coinciden con org_permission_implied() de la base", () => {
    const front = Object.entries(PERMISSION_IMPLIES).flatMap(([k, vs]) => vs!.map((v) => `${k}→${v}`)).sort();
    expect(front).toEqual(sqlImplications().map(([k, v]) => `${k}→${v}`).sort());
  });

  it("los implícitos son transitivos y quedan en orden de catálogo", () => {
    expect(withImpliedPermissions(["invoices.create"])).toEqual(["prices.view", "invoices.view", "invoices.create"]);
    expect(withImpliedPermissions(["kennels.move"])).toEqual(["kennels.move"]);
  });

  it("explica qué permiso marcado obliga a tener otro", () => {
    expect(permissionRequiredBy("reservations.view_all", ["reservations.view_all", "stays.checkin"])).toEqual(["stays.checkin"]);
    expect(permissionRequiredBy("reservations.view_all", ["reservations.view_all"])).toEqual([]);
  });

  it("estado de reserva → permiso (espejo de reservation_status_permission)", () => {
    expect(reservationStatusPermission("requested", "scheduled")).toBe("reservations.approve");
    expect(reservationStatusPermission("requested", "cancelled")).toBe("reservations.approve");
    expect(reservationStatusPermission("scheduled", "cancelled")).toBe("reservations.cancel");
    expect(reservationStatusPermission("scheduled", "no_show")).toBe("reservations.cancel");
    expect(reservationStatusPermission("scheduled", "checked_in")).toBe("stays.checkin");
    expect(reservationStatusPermission("checked_in", "completed")).toBe("stays.checkout");
    expect(reservationStatusPermission("cancelled", "scheduled")).toBe("reservations.edit");
  });

  it("la especialidad suma permisos sin depender del rol", () => {
    const role = { access_type: "worker" as const, permissions: ["weight.record" as const] };
    expect(roleHasPermission(role, "report_cards.write")).toBe(false);
    expect(roleHasPermission(role, "report_cards.write", "trainer")).toBe(true);
    expect(roleHasPermission(role, "clinical.edit", "trainer")).toBe(false);
  });
});
