import { describe, it, expect } from "vitest";
import {
  contractBodyToHtml,
  describeDuration,
  extractCustomVariables,
  numberToSpanishWords,
  renderTemplate,
} from "@/lib/contracts";

describe("numberToSpanishWords", () => {
  it.each([
    [0, "cero"],
    [1, "uno"],
    [21, "veintiuno"],
    [100, "cien"],
    [101, "ciento uno"],
    [1000, "mil"],
    [21000, "veintiún mil"],
    [800000, "ochocientos mil"],
    [1000000, "un millón"],
    [1250000, "un millón doscientos cincuenta mil"],
    [2001500, "dos millones mil quinientos"],
    [21000000, "veintiún millones"],
  ])("%d → %s", (n, words) => {
    expect(numberToSpanishWords(n)).toBe(words);
  });
});

describe("renderTemplate", () => {
  it("reemplaza variables sin importar espacios ni mayúsculas", () => {
    expect(renderTemplate("Hola {{ cliente_nombre }} y {{PERRO_NOMBRE}}", { cliente_nombre: "Ana", perro_nombre: "Luna" }))
      .toBe("Hola Ana y Luna");
  });

  it("deja una línea para llenar a mano si falta el valor", () => {
    expect(renderTemplate("Doc: {{cliente_documento}}", {})).toBe("Doc: ________________");
  });
});

describe("extractCustomVariables", () => {
  it("devuelve solo las variables fuera del catálogo, sin repetir", () => {
    expect(extractCustomVariables("{{cliente_nombre}} {{horario}} {{horario}} {{placa_vehiculo}}"))
      .toEqual(["horario", "placa_vehiculo"]);
  });
});

describe("contractBodyToHtml", () => {
  it("escapa HTML del texto y aplica encabezados y negrita", () => {
    const html = contractBodyToHtml("# Título\n\nTexto <script>x</script> **firme**");
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>firme</strong>");
    expect(html).not.toContain("<script>");
  });
});

describe("describeDuration", () => {
  it("cuenta noches para internados y días inclusivos para lo demás", () => {
    expect(describeDuration("2026-10-01", "2026-10-06", true)).toBe("5 noches");
    expect(describeDuration("2026-10-01", "2026-10-05", false)).toBe("5 días");
    expect(describeDuration("2026-10-01", "2026-10-30", false)).toBe("1 mes");
    expect(describeDuration("2026-10-05", "2026-10-01", false)).toBe("");
  });
});

describe("contractBodyToHtml — encabezado seguido de texto", () => {
  it("separa el encabezado del párrafo que viene en la línea siguiente", () => {
    const html = contractBodyToHtml("## PRIMERA. Objeto\nEl prestador recibirá\na la mascota.");
    expect(html).toBe("<h2>PRIMERA. Objeto</h2>\n<p>El prestador recibirá<br />a la mascota.</p>");
  });
});

describe("dogVariables", () => {
  it("junta varios perros y describe cada uno", async () => {
    const { dogVariables } = await import("@/lib/contracts");
    const v = dogVariables([
      { name: "Luna", breed: "Golden", gender: "female" },
      { name: "Max", breed: "Beagle", gender: "male", color: "Tricolor" },
    ]);
    expect(v.perro_nombre).toBe("Luna y Max");
    expect(v.perro_raza).toBe("Golden / Beagle");
    expect(v.perro_color).toBe("— / Tricolor");
    expect(v.mascotas).toBe("**Luna** (Golden, hembra) y **Max** (Beagle, macho, Tricolor)");
  });
});
