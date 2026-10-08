import { describe, it, expect } from "vitest";
import {
  buildDogIndex, detectKind, dropWeightsInConsultations, mapColumns, mapProductType, mapRecordType, mapVaccineType,
  matchDog, normalizeHeader, parseClinicalRows, type OrgDog,
} from "@/lib/clinicalImport";

const dogs: OrgDog[] = [
  { id: "d-apolo-1", name: "APOLO", microchip_number: "985112000111", owner_name: "Ana Gómez", owner_phone: "+573001112233" },
  { id: "d-apolo-2", name: "Apolo", microchip_number: null, owner_name: "Carlos Ruiz", owner_phone: "3109998877" },
  { id: "d-luna", name: "Luna", microchip_number: null, owner_name: "María Pérez", owner_phone: null },
];
const index = buildDogIndex(dogs);

describe("columnas y tipo de archivo", () => {
  it("normaliza encabezados con tildes y espacios", () => {
    expect(normalizeHeader(" Fecha de Aplicación ")).toBe("fecha_de_aplicacion");
    expect(normalizeHeader("Diagnóstico")).toBe("diagnostico");
  });

  it("reconoce las columnas de Tails Up y las de otras plataformas", () => {
    expect(mapColumns(["dog_id", "record_date", "reason"], "medical")).toMatchObject({ dog_id: "dog_id", record_date: "record_date", reason: "reason" });
    expect(mapColumns(["Paciente", "Fecha", "Motivo de consulta", "Diagnóstico", "Fórmula médica"], "medical"))
      .toMatchObject({ dog_name: "Paciente", record_date: "Fecha", reason: "Motivo de consulta", diagnosis: "Diagnóstico", prescription: "Fórmula médica" });
  });

  it("detecta el tipo por columnas o por nombre del archivo", () => {
    expect(detectKind(["dog_id", "dog_name", "record_date", "reason", "diagnosis"])).toBe("medical");
    expect(detectKind(["dog_id", "product_name", "product_type", "date_administered"])).toBe("deworming");
    expect(detectKind(["dog_id", "weight", "recorded_at"])).toBe("weights");
    expect(detectKind(["Mascota", "Vacuna", "Fecha", "Lote"])).toBe("vaccines");
    expect(detectKind(["Mascota", "Producto", "Fecha"], "vacunas_2026.xlsx")).toBe("vaccines");
    expect(detectKind(["Mascota", "Producto", "Fecha"], "desparasitaciones.csv")).toBe("deworming");
    // Hoja de resumen sin perro: no se importa
    expect(detectKind(["Perros OkVet", "Confianza"])).toBeNull();
  });

  it("traduce los tipos de cada plataforma", () => {
    expect(mapRecordType("Seguimiento")).toEqual({ value: "checkup", original: null });
    expect(mapRecordType("checkup")).toEqual({ value: "checkup", original: null });
    expect(mapRecordType("Cirugía")).toEqual({ value: "surgery", original: null });
    expect(mapRecordType("Remisión")).toEqual({ value: "consultation", original: null });
    expect(mapRecordType("Peluquería")).toEqual({ value: "consultation", original: "Peluquería" });
    expect(mapProductType("Externa")).toBe("external");
    expect(mapProductType("interna y externa")).toBe("both");
    expect(mapProductType("")).toBe("internal");
    expect(mapVaccineType("Refuerzo")).toBe("booster");
    expect(mapVaccineType("No esencial")).toBe("non_core");
  });
});

describe("emparejar perros", () => {
  it("por id, microchip, o nombre único", () => {
    expect(matchDog({ dogId: "d-luna" }, index)).toMatchObject({ dog: { id: "d-luna" }, by: "id" });
    expect(matchDog({ microchip: "985 112 000 111", dogName: "otro" }, index)).toMatchObject({ dog: { id: "d-apolo-1" }, by: "microchip" });
    expect(matchDog({ dogName: "  luna " }, index)).toMatchObject({ dog: { id: "d-luna" }, by: "name" });
  });

  it("si el nombre se repite, decide el dueño o el teléfono; si no, no adivina", () => {
    expect(matchDog({ dogName: "Apolo" }, index)).toEqual({ dog: null, reason: "ambiguous" });
    expect(matchDog({ dogName: "Apolo", ownerName: "CARLOS RUIZ" }, index)).toMatchObject({ dog: { id: "d-apolo-2" }, by: "name_owner" });
    expect(matchDog({ dogName: "Apolo", ownerPhone: "300 111 2233" }, index)).toMatchObject({ dog: { id: "d-apolo-1" } });
    expect(matchDog({ dogName: "Apolo", ownerName: "Pedro Nadie" }, index)).toEqual({ dog: null, reason: "ambiguous" });
  });

  it("un id de otra plataforma no bloquea el emparejamiento por nombre", () => {
    expect(matchDog({ dogId: "okvet-2754300", dogName: "Luna" }, index)).toMatchObject({ dog: { id: "d-luna" }, by: "name" });
    expect(matchDog({ dogName: "Rocky" }, index)).toEqual({ dog: null, reason: "not_found" });
  });
});

describe("leer filas", () => {
  it("formato OkVet → Tails Up (con dog_id ya asignado)", () => {
    const rows = [
      {
        dog_id: "d-apolo-1", dog_name: "APOLO", organization_id: "org", record_date: "2026-06-03", record_type: "consultation",
        veterinarian: "natalia arroyave", reason: "Consulta general", diagnosis: "I. DERMATOFITOSIS", treatment: "aplicación tópica",
        prescription: "CUTAMICON #1", weight: "59", temperature: "37", heart_rate: "", respiratory_rate: "", blood_pressure: "",
        body_condition_score: "3", notes: "Origen: OkVet · Consulta #2562554", next_appointment: "",
      },
      // perro que no está en el centro: se ignora
      { dog_id: "no-existe", dog_name: "THOR", record_date: "2026-06-03", reason: "Consulta" },
    ];
    const r = parseClinicalRows(rows, "medical", index);
    expect(r.records).toHaveLength(1);
    expect(r.records[0].data).toMatchObject({
      dog_id: "d-apolo-1", record_date: "2026-06-03", record_type: "consultation", weight: 59, temperature: 37,
      heart_rate: null, body_condition_score: 3, next_appointment: null, notes: "Origen: OkVet · Consulta #2562554",
    });
    expect(r.noDog).toEqual([{ row: 3, dogName: "THOR", reason: "El perro no está registrado en el centro" }]);
    expect(r.errors).toHaveLength(0);
  });

  it("otra plataforma: fechas dd/mm/aaaa con hora, unidades y valores fuera de rango", () => {
    const rows = [
      { Paciente: "Luna", Fecha: "15/03/2026 10:30", Motivo: "Vómito", Peso: "28,5 kg", Temperatura: "385", "Próxima cita": "22/12/2099" },
      { Paciente: "Luna", Fecha: "31/02/2026", Motivo: "Control" },
      { Paciente: "Luna", Fecha: "16/03/2026" },
    ];
    const r = parseClinicalRows(rows, "medical", index);
    expect(r.records).toHaveLength(1);
    expect(r.records[0].data).toMatchObject({ record_date: "2026-03-15", weight: 28.5, temperature: null, next_appointment: "2099-12-22" });
    expect(r.warnings.map((w) => w.reason)).toEqual(['Temperatura "385" fuera de rango; se omite']);
    expect(r.errors.map((e) => e.reason)).toEqual([
      'Fecha "31/02/2026" no es válida',
      "La consulta no trae motivo, diagnóstico, tratamiento ni notas",
    ]);
  });

  it("vacunas y desparasitaciones", () => {
    const vac = parseClinicalRows([{ Mascota: "Luna", Vacuna: "Rabia", Fecha: "10/01/2026", "Próxima dosis": "10/01/2027", Lote: "L1" }], "vaccines", index);
    expect(vac.records[0].data).toMatchObject({ vaccine_name: "Rabia", date_administered: "2026-01-10", next_dose_date: "2027-01-10", batch_number: "L1", vaccine_type: "core" });
    const dew = parseClinicalRows([{ dog_id: "d-luna", product_name: "Fenbendazol", product_type: "internal", date_administered: "2026-07-15" }, { dog_id: "d-luna", date_administered: "2026-07-15" }], "deworming", index);
    expect(dew.records).toHaveLength(1);
    expect(dew.errors.map((e) => e.reason)).toEqual(["Falta el producto"]);
  });

  it("pesos que ya vienen en una consulta no se repiten", () => {
    const med = parseClinicalRows([{ dog_id: "d-luna", record_date: "2026-06-03", reason: "Control", weight: "20" }], "medical", index);
    const w = parseClinicalRows([
      { dog_id: "d-luna", recorded_at: "2026-06-03", weight: "20" },
      { dog_id: "d-luna", recorded_at: "2026-06-10", weight: "20.4" },
    ], "weights", index);
    const { kept, dropped } = dropWeightsInConsultations(w.records, med.records);
    expect(dropped).toBe(1);
    expect(kept.map((k) => k.data.recorded_at)).toEqual(["2026-06-10"]);
  });
});
