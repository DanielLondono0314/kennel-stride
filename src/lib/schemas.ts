import { z } from "zod";

const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email es requerido")
  .email("Email inválido")
  .max(254, "Email demasiado largo");

export const phoneSchema = z
  .string()
  .trim()
  .regex(phoneRegex, "Teléfono inválido")
  .or(z.literal(""));

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Requerido")
  .max(80, "Máximo 80 caracteres");

export const specialtySchema = z.enum(["trainer", "groomer", "cleaning", "welfare", "vet"]);

export const staffMemberSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().default(""),
  role_id: z.string().uuid("Selecciona un rol"),
  specialty: specialtySchema.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const invitationSchema = z.object({
  email: emailSchema,
  role_id: z.string().uuid("Selecciona un rol"),
});

// El formulario de cliente marca Teléfono con * — el schema lo exige de verdad.
export const customerPhoneSchema = z
  .string()
  .trim()
  .min(1, "Teléfono es requerido")
  .regex(phoneRegex, "Teléfono inválido");

export const customerSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: emailSchema,
  phone: customerPhoneSchema,
  id_document_type: z.enum(["CC", "CE", "TI", "PA", "PPT", "NIT"]),
  id_document: z
    .string()
    .trim()
    .min(3, "Documento requerido")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[0-9A-Za-z .-]+$/, "Solo números, letras, puntos y guiones"),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  zip_code: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).superRefine((c, ctx) => {
  // Reglas por tipo de documento (QA E-12: la cédula aceptaba "abc").
  const digits = c.id_document.replace(/[.\s-]/g, "");
  const invalid = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["id_document"], message });
  if (c.id_document_type === "CC" && !/^\d{5,10}$/.test(digits)) invalid("La cédula debe tener entre 5 y 10 números");
  if (c.id_document_type === "TI" && !/^\d{10,11}$/.test(digits)) invalid("La tarjeta de identidad debe tener 10 u 11 números");
  if (c.id_document_type === "NIT" && !/^\d{9,10}$/.test(digits)) invalid("El NIT debe tener 9 números más el dígito de verificación");
});

export const dogSchema = z.object({
  name: nameSchema,
  breed: nameSchema,
  gender: z.enum(["male", "female"]),
  weight: z.number().positive().max(200).optional().nullable(),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  microchip_number: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Descripción requerida").max(200),
  quantity: z.number().int().positive("Cantidad debe ser mayor a 0").max(9999),
  unit_price: z.number().min(0, "Precio no puede ser negativo").max(1_000_000),
});

export const invoiceSchema = z.object({
  customer_id: z.string().uuid("Cliente requerido"),
  due_date: z.string().min(1, "Fecha de vencimiento requerida"),
  items: z.array(invoiceItemSchema).min(1, "Agrega al menos un concepto"),
  discount: z.number().min(0).max(1_000_000).default(0),
  tax: z.number().min(0).max(1_000_000).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

// Campos opcionales de formularios: un input vacío llega como "" (o null) y
// debe contar como "no indicado", no como 0 ni como una opción inválida.
// Sin esto, z.coerce.number() convertía "" en 0 y .positive() lo rechazaba,
// y z.enum rechazaba "" — el formulario de perro exigía Porción y Unidad
// aunque no tuvieran asterisco (QA E-01).
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const optionalNumber = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());
const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

export const feedingSchema = z.object({
  food_type: z.enum(["seco", "humedo", "crudo", "mixto"], {
    errorMap: () => ({ message: "Elige el tipo de comida" }),
  }),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  meals_per_day: z.coerce.number().int().min(1, "Indica cuántas comidas al día").max(12),
  portion_amount: optionalNumber(z.coerce.number().positive("La porción debe ser mayor a 0").max(10000)),
  portion_unit: optionalEnum(["g", "taza", "scoop"]),
  instructions: z.string().trim().max(500).optional().or(z.literal("")),
}).refine((f) => f.portion_amount === undefined || f.portion_unit !== undefined, {
  message: "Elige la unidad de la porción",
  path: ["portion_unit"],
});

export const aggressionDetailsSchema = z.object({
  severity: z.enum(["baja", "media", "alta"], {
    errorMap: () => ({ message: "Elige la severidad" }),
  }),
  handling: z.string().trim().min(1, "Describe el manejo").max(500),
  requires_muzzle: z.boolean().default(false),
  handle_alone: z.boolean().default(false),
  no_other_dogs: z.boolean().default(false),
});

export const allergyRowSchema = z.object({
  allergen: z.string().trim().min(1, "Indica el alérgeno").max(80),
  type: z.enum(["comida", "ambiental", "medicamento"], {
    errorMap: () => ({ message: "Elige el tipo de alergia" }),
  }),
  reaction: z.string().trim().max(200).optional().or(z.literal("")),
  severity: optionalEnum(["baja", "media", "alta"]),
});

export const medicationRowSchema = z.object({
  name: z.string().trim().min(1, "Indica el medicamento").max(120),
  dose: z.string().trim().max(80).optional().or(z.literal("")),
  frequency: z.string().trim().max(80).optional().or(z.literal("")),
  duration_days: optionalNumber(z.coerce.number().int().positive("La duración debe ser mayor a 0").max(3650)),
  start_date: z.string().optional().or(z.literal("")),
  route: optionalEnum(["oral", "topica", "inyectable"]),
  with_food: z.boolean().default(false),
});

export type FeedingInput = z.infer<typeof feedingSchema>;
export type AggressionDetailsInput = z.infer<typeof aggressionDetailsSchema>;
export type AllergyRowInput = z.infer<typeof allergyRowSchema>;
export type MedicationRowInput = z.infer<typeof medicationRowSchema>;

export type StaffMemberInput = z.infer<typeof staffMemberSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type DogInput = z.infer<typeof dogSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
