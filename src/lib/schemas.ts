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

export const customerSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
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

export type StaffMemberInput = z.infer<typeof staffMemberSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type DogInput = z.infer<typeof dogSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
