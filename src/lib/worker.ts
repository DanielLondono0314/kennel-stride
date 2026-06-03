export type Specialty = "trainer" | "groomer" | "cleaning" | "welfare" | "vet";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  trainer: "Entrenador",
  groomer: "Grooming",
  cleaning: "Aseo",
  welfare: "Bienestar animal",
  vet: "Veterinario",
};

export type TaskType = "cleaning" | "feeding" | "walk" | "vet_check" | "grooming" | "other";

export const TASK_TYPES: TaskType[] = ["cleaning", "feeding", "walk", "vet_check", "grooming", "other"];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  cleaning: "Aseo",
  feeding: "Alimentación",
  walk: "Paseo",
  vet_check: "Chequeo veterinario",
  grooming: "Grooming",
  other: "Otro",
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
  welfare: ["feeding", "walk"],
  vet: ["vet_check"],
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
