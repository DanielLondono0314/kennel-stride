import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { Reservation, ReservationStatus, ServiceType } from "@/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dog } from "lucide-react";

interface MonthViewProps {
  currentDate: Date;
  reservations: Reservation[];
  onSelectReservation: (reservation: Reservation) => void;
  onSelectDay: (date: Date) => void;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const serviceColorsDot: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "bg-info",
  [ServiceType.BOARD_AND_TRAIN]: "bg-primary",
  [ServiceType.TRAINING_SESSION]: "bg-success",
  [ServiceType.GROOMING]: "bg-warning",
  [ServiceType.EVALUATION]: "bg-status-requested",
};

export function MonthView({
  currentDate,
  reservations,
  onSelectReservation,
  onSelectDay,
}: MonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Group reservations by day
  const reservationsByDay = useMemo(() => {
    const grouped: Record<string, Reservation[]> = {};
    calendarDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = reservations.filter((r) => {
        const resDate = new Date(r.startDate);
        return isSameDay(resDate, day);
      });
    });
    return grouped;
  }, [reservations, calendarDays]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 bg-muted/30 border-b">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="divide-y">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 divide-x min-h-[120px]">
            {week.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayReservations = reservationsByDay[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const displayedReservations = dayReservations.slice(0, 3);
              const remainingCount = dayReservations.length - 3;

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "p-2 cursor-pointer transition-colors hover:bg-muted/50",
                    !isCurrentMonth && "bg-muted/20",
                    isToday(day) && "bg-primary/5"
                  )}
                  onClick={() => onSelectDay(day)}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-sm",
                        isToday(day) &&
                          "rounded-full bg-primary text-primary-foreground font-semibold",
                        !isCurrentMonth && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Reservations */}
                  <div className="space-y-1">
                    {displayedReservations.map((reservation) => {
                      const dotColor =
                        serviceColorsDot[
                          reservation.service?.type || ServiceType.DAYCARE
                        ];

                      return (
                        <Tooltip key={reservation.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs bg-muted/60 hover:bg-muted cursor-pointer truncate"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectReservation(reservation);
                              }}
                            >
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  dotColor
                                )}
                              />
                              <span className="truncate font-medium">
                                {reservation.dog?.name}
                              </span>
                              <span className="text-muted-foreground ml-auto">
                                {format(new Date(reservation.startDate), "HH:mm")}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Dog className="h-4 w-4" />
                                <span className="font-semibold">
                                  {reservation.dog?.name}
                                </span>
                              </div>
                              <p className="text-sm">{reservation.service?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(reservation.startDate), "HH:mm")} -{" "}
                                {format(new Date(reservation.endDate), "HH:mm")}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {remainingCount > 0 && (
                      <div className="text-xs text-muted-foreground px-1.5">
                        +{remainingCount} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
