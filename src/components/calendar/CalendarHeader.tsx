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
import { format, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export type CalendarView = "week" | "month";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onNewReservation: () => void;
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
      return format(currentDate, "'Semana del' d 'de' MMMM, yyyy", { locale: es });
    }
    return format(currentDate, "MMMM yyyy", { locale: es });
  };

  return (
    <div className="flex items-center justify-between pb-4 border-b">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Calendario</h1>
        </div>
        <Badge variant="secondary" className="text-xs">
          {reservationCount} reservas
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Current date label */}
        <div className="min-w-[240px] text-center">
          <span className="font-medium capitalize">{getDateRangeLabel()}</span>
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
        <Button onClick={onNewReservation} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Reserva
        </Button>
      </div>
    </div>
  );
}
