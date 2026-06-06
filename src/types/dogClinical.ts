// Tipos del FORMULARIO (permiten "" para campos sin elegir). En guardado se
// normalizan a las formas JSONB / fila de la BD.
export type Severity = "baja" | "media" | "alta";
export type FoodType = "seco" | "humedo" | "crudo" | "mixto";
export type PortionUnit = "g" | "taza" | "scoop";
export type AllergyType = "comida" | "ambiental" | "medicamento";
export type MedRoute = "oral" | "topica" | "inyectable";

export interface AggressionForm {
  severity: Severity | "";
  handling: string;
  requires_muzzle: boolean;
  handle_alone: boolean;
  no_other_dogs: boolean;
}

export interface FeedingForm {
  food_type: FoodType | "";
  brand: string;
  meals_per_day: number | "";
  portion_amount: number | "";
  portion_unit: PortionUnit | "";
  instructions: string;
}

export interface AllergyRow {
  allergen: string;
  type: AllergyType | "";
  reaction: string;
  severity: Severity | "";
}

export interface MedicationRow {
  name: string;
  dose: string;
  frequency: string;
  duration_days: number | "";
  start_date: string;
  route: MedRoute | "";
  with_food: boolean;
}

export const emptyAggression = (): AggressionForm => ({
  severity: "",
  handling: "",
  requires_muzzle: false,
  handle_alone: false,
  no_other_dogs: false,
});

export const emptyFeeding = (): FeedingForm => ({
  food_type: "",
  brand: "",
  meals_per_day: "",
  portion_amount: "",
  portion_unit: "",
  instructions: "",
});

export const emptyAllergy = (): AllergyRow => ({
  allergen: "",
  type: "",
  reaction: "",
  severity: "",
});

export const emptyMedication = (): MedicationRow => ({
  name: "",
  dose: "",
  frequency: "",
  duration_days: "",
  start_date: "",
  route: "",
  with_food: false,
});
