import { describe, it, expect } from "vitest";
import { toE164, normalizePhone, whatsappHref, telHref } from "@/lib/contact";

describe("teléfonos (QA E-17, E-32)", () => {
  it.each([
    ["3001234567", "+573001234567"],
    ["300 123 4567", "+573001234567"],
    ["+57 300 123 4567", "+573001234567"],
    ["573001234567", "+573001234567"],
    ["604 444 5566", "+576044445566"],
    ["+1 305 555 0100", "+13055550100"],
  ])("%s → %s", (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it("deja igual lo que no reconoce", () => {
    expect(toE164("12345")).toBeNull();
    expect(normalizePhone("ext. 12345")).toBe("ext. 12345");
  });

  it("arma enlaces de WhatsApp y llamada", () => {
    expect(whatsappHref("300 123 4567")).toBe("https://wa.me/573001234567");
    expect(telHref("300 123 4567")).toBe("tel:+573001234567");
    expect(whatsappHref("")).toBeNull();
  });
});
