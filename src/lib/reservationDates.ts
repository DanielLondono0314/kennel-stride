import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Rango de una reserva legible. Mismo día → "25 sep · 10:00 – 11:00";
 * varios días → "25 sep 10:00 → 30 sep 17:00". Antes se mostraba solo
 * "HH:mm – HH:mm" y una estadía de 5 días parecía durar 0 minutos (QA E-24).
 */
export function formatReservationRange(start: Date, end: Date, { withDay = true } = {}): string {
  if (isSameDay(start, end)) {
    const hours = `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;
    return withDay ? `${format(start, "d MMM", { locale: es })} · ${hours}` : hours;
  }
  return `${format(start, "d MMM HH:mm", { locale: es })} → ${format(end, "d MMM HH:mm", { locale: es })}`;
}
