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
