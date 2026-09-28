import { Reservation } from "@/types";

/** Una tarea (de la tabla `tasks`) tal como se necesita para dibujarla en el calendario. */
export interface CalendarTask {
  id: string;
  title: string;
  type: string;
  status: string;
  dueAt: string;
  dogName: string | null;
  staffId: string | null;
  staffName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  notes: string | null;
}

/**
 * Forma común para dibujar reservas Y tareas en el mismo grid de
 * WeekView/MonthView. `reservation`/`task` quedan disponibles para el
 * detalle (tooltip, click) según `kind`.
 */
export interface CalendarEvent {
  id: string;
  kind: "reservation" | "task";
  startDate: Date;
  endDate: Date;
  staffId: string | null;
  zoneName: string | null;
  typeKey: string; // service.type (reserva) o task.type (tarea) — para el filtro "tipo"
  reservation?: Reservation;
  task?: CalendarTask;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/** Estadía que cruza al menos una medianoche (internado, hotel…). */
export function isMultiDay(e: Pick<CalendarEvent, "startDate" | "endDate">): boolean {
  return dayStart(e.startDate).getTime() !== dayStart(e.endDate).getTime();
}

/** ¿El evento ocupa alguna parte de ese día? (Antes solo contaba el día de entrada — QA E-24.) */
export function occursOn(e: Pick<CalendarEvent, "startDate" | "endDate">, day: Date): boolean {
  return e.startDate < dayEnd(day) && e.endDate >= dayStart(day);
}

/** Etiqueta del tramo de una estadía en un día: entrada, salida o intermedio. */
export function stayPhase(e: Pick<CalendarEvent, "startDate" | "endDate">, day: Date): "start" | "end" | "middle" {
  if (dayStart(e.startDate).getTime() === dayStart(day).getTime()) return "start";
  if (dayStart(e.endDate).getTime() === dayStart(day).getTime()) return "end";
  return "middle";
}
