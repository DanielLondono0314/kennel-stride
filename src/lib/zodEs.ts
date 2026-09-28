import { z } from "zod";

/**
 * Mensajes de Zod en español para toda la app. Los esquemas con mensaje propio
 * lo conservan; esto cubre los que no lo tienen (antes el usuario veía, p. ej.,
 * "Number must be greater than 0" — QA E-13).
 */
export const zodErrorMapEs: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Campo obligatorio" };
      if (issue.expected === "integer") return { message: "Debe ser un número entero" };
      if (issue.expected === "number") return { message: "Debe ser un número" };
      return { message: "Valor inválido" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Elige una opción válida" };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Correo electrónico inválido" };
      if (issue.validation === "url") return { message: "Enlace inválido" };
      if (issue.validation === "uuid") return { message: "Selecciona una opción" };
      return { message: "Formato inválido" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "Campo obligatorio" : `Debe tener al menos ${issue.minimum} caracteres` };
      }
      if (issue.type === "number") {
        return {
          message: issue.inclusive
            ? `Debe ser mayor o igual a ${issue.minimum}`
            : `Debe ser mayor a ${issue.minimum}`,
        };
      }
      if (issue.type === "array") return { message: `Agrega al menos ${issue.minimum}` };
      return { message: "Valor demasiado pequeño" };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Máximo ${issue.maximum} caracteres` };
      if (issue.type === "number") {
        return {
          message: issue.inclusive
            ? `Debe ser menor o igual a ${issue.maximum}`
            : `Debe ser menor a ${issue.maximum}`,
        };
      }
      if (issue.type === "array") return { message: `Máximo ${issue.maximum} elementos` };
      return { message: "Valor demasiado grande" };
    case z.ZodIssueCode.invalid_date:
      return { message: "Fecha inválida" };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(zodErrorMapEs);
