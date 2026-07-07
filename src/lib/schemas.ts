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

export const staffRoleSchema = z.enum(["admin", "front_desk", "worker", "manager"]);
export const specialtySchema = z.enum(["trainer", "groomer", "cleaning", "welfare", "vet"]);

export const staffMemberSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().default(""),
  role: staffRoleSchema,
  specialty: specialtySchema.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const invitationSchema = z.object({
  email: emailSchema,
  role: staffRoleSchema,
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
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  zip_code: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
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

export const feedingSchema = z.object({
  food_type: z.enum(["seco", "humedo", "crudo", "mixto"], {
    errorMap: () => ({ message: "Elige el tipo de comida" }),
  }),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  meals_per_day: z.coerce.number().int().min(1, "Indica cuántas comidas al día").max(12),
  portion_amount: z.coerce.number().positive().max(10000).optional().nullable(),
  portion_unit: z.enum(["g", "taza", "scoop"]).optional().nullable(),
  instructions: z.string().trim().max(500).optional().or(z.literal("")),
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
  severity: z.enum(["baja", "media", "alta"]).optional().nullable(),
});

export const medicationRowSchema = z.object({
  name: z.string().trim().min(1, "Indica el medicamento").max(120),
  dose: z.string().trim().max(80).optional().or(z.literal("")),
  frequency: z.string().trim().max(80).optional().or(z.literal("")),
  duration_days: z.coerce.number().int().positive().max(3650).optional().nullable(),
  start_date: z.string().optional().or(z.literal("")),
  route: z.enum(["oral", "topica", "inyectable"]).optional().nullable(),
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
