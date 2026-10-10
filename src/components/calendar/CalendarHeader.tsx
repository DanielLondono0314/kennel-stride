import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Filter,
} from "lucide-react";
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";

export type CalendarView = "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  /** Sin esto (el rol no crea reservas) no hay botón. */
  onNewReservation?: () => void;
  reservationCount: number;
}

export function CalendarHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onNewReservation,
  reservationCount,
}: CalendarHeaderProps) {
  const handlePrevious = () => {
    if (view === "week") {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "week") {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getDateRangeLabel = () => {
    if (view === "week") {
      // Rango real de la semana (lunes a domingo): "21–27 sep 2026" (QA E-06).
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "d")}–${format(end, "d MMM yyyy", { locale: es })}`;
      }
      if (start.getFullYear() === end.getFullYear()) {
        return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
      }
      return `${format(start, "d MMM yyyy", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
    }
    const month = format(currentDate, "MMMM yyyy", { locale: es });
    return month.charAt(0).toUpperCase() + month.slice(1);
  };

  return (
    <div className="flex items-center justify-between pb-4 border-b">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Calendario</h1>
        </div>
        <Badge variant="secondary" className="text-xs">
          {reservationCount} {reservationCount === 1 ? "evento" : "eventos"}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={handlePrevious} aria-label="Periodo anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} aria-label="Periodo siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Current date label */}
        <div className="min-w-[240px] text-center">
          <span className="font-medium">{getDateRangeLabel()}</span>
        </div>

        {/* View toggle */}
        <Select value={view} onValueChange={(v) => onViewChange(v as CalendarView)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mes</SelectItem>
          </SelectContent>
        </Select>

        {/* New reservation */}
        {onNewReservation && (
          <Button onClick={onNewReservation} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reserva
          </Button>
        )}
      </div>
    </div>
  );
}
