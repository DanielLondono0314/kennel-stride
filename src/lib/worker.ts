export type Specialty = "trainer" | "groomer" | "cleaning" | "welfare" | "vet" | "driver";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  trainer: "Entrenador",
  groomer: "Grooming",
  cleaning: "Aseo",
  welfare: "Bienestar animal",
  vet: "Veterinario",
  driver: "Chofer",
};

export type TaskType =
  | "cleaning" | "feeding" | "walk" | "vet_check" | "grooming" | "other" | "welfare_check"
  | "route_pickup" | "route_dropoff";

export const TASK_TYPES: TaskType[] = [
  "cleaning", "feeding", "walk", "vet_check", "grooming", "other", "welfare_check",
  "route_pickup", "route_dropoff",
];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  cleaning: "Aseo",
  feeding: "Alimentación",
  walk: "Paseo",
  vet_check: "Chequeo veterinario",
  grooming: "Grooming",
  other: "Otro",
  welfare_check: "Ronda de bienestar",
  route_pickup: "Ruta de recogida",
  route_dropoff: "Ruta de entrega",
};

export type TaskPriority = "low" | "normal" | "high";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
};

export const TASK_TYPE_BY_SPECIALTY: Record<Specialty, TaskType[]> = {
  trainer: ["other"],
  groomer: ["grooming"],
  cleaning: ["cleaning"],
  welfare: ["feeding", "walk", "welfare_check"],
  vet: ["vet_check"],
  driver: ["route_pickup", "route_dropoff"],
};

export type WorkStatus = "pending" | "in_progress" | "done" | "skipped";

export const STATUS_LABELS: Record<"pending" | "in_progress" | "done", string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecho",
};

/** Maps a reservation status to the worker feed bucket. */
export function reservationBucket(status: string): "pending" | "in_progress" | "done" {
  if (["completed", "picked_up", "ready"].includes(status)) return "done";
  if (["in_progress", "checked_in"].includes(status)) return "in_progress";
  return "pending";
}

/** Rol base del personal (staff_members.role) en español. */
export const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  front_desk: "Recepción",
  worker: "Trabajador",
};
