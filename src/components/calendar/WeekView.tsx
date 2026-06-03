import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addHours,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { Reservation, ReservationStatus, ServiceType } from "@/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dog, Clock } from "lucide-react";

interface WeekViewProps {
  currentDate: Date;
  reservations: Reservation[];
  onSelectReservation: (reservation: Reservation) => void;
  onSelectSlot: (date: Date) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 6;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const serviceColors: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "bg-info/20 border-info text-info",
  [ServiceType.BOARD_AND_TRAIN]: "bg-primary/20 border-primary text-primary",
  [ServiceType.TRAINING_SESSION]: "bg-success/20 border-success text-success",
  [ServiceType.GROOMING]: "bg-warning/20 border-warning text-warning",
  [ServiceType.EVALUATION]: "bg-status-requested/20 border-status-requested text-status-requested",
};

const statusIndicators: Record<ReservationStatus, string> = {
  [ReservationStatus.REQUESTED]: "bg-status-requested",
  [ReservationStatus.SCHEDULED]: "bg-status-scheduled",
  [ReservationStatus.CHECKED_IN]: "bg-status-checked-in",
  [ReservationStatus.IN_PROGRESS]: "bg-status-in-progress",
  [ReservationStatus.READY]: "bg-status-ready",
  [ReservationStatus.PICKED_UP]: "bg-status-completed",
  [ReservationStatus.COMPLETED]: "bg-status-completed",
  [ReservationStatus.CANCELLED]: "bg-muted",
};

export function WeekView({
  currentDate,
  reservations,
  onSelectReservation,
  onSelectSlot,
}: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Group reservations by day
  const reservationsByDay = useMemo(() => {
    const grouped: Record<string, Reservation[]> = {};
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = reservations.filter((r) => {
        const resDate = new Date(r.startDate);
        return isSameDay(resDate, day);
      });
    });
    return grouped;
  }, [reservations, weekDays]);

  const calculateEventPosition = (reservation: Reservation) => {
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    
    const startHour = getHours(startDate) + getMinutes(startDate) / 60;
    const endHour = getHours(endDate) + getMinutes(endDate) / 60;
    
    const top = (startHour - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 24);
    
    return { top, height };
  };

  const handleSlotClick = (day: Date, hour: number) => {
    const slotDate = setMinutes(setHours(day, hour), 0);
    onSelectSlot(slotDate);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] border rounded-lg bg-card overflow-hidden">
      {/* Header with day names */}
      <div className="flex border-b bg-muted/30">
        <div className="w-16 flex-shrink-0 border-r" />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "flex-1 py-3 px-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-primary/5"
            )}
          >
            <p className="text-xs text-muted-foreground uppercase">
              {format(day, "EEE", { locale: es })}
            </p>
            <p
              className={cn(
                "text-lg font-semibold",
                isToday(day) &&
                  "w-8 h-8 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              )}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <ScrollArea className="flex-1">
        <div className="flex">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b text-xs text-muted-foreground pr-2 text-right pt-1"
              >
                {format(setHours(new Date(), hour), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayReservations = reservationsByDay[dayKey] || [];

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex-1 relative border-r last:border-r-0",
                  isToday(day) && "bg-primary/5"
                )}
              >
                {/* Hour slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleSlotClick(day, hour)}
                  />
                ))}

                {/* Reservation events */}
                {dayReservations.map((reservation) => {
                  const { top, height } = calculateEventPosition(reservation);
                  const colorClass = serviceColors[reservation.service?.type || ServiceType.DAYCARE];
                  const statusClass = statusIndicators[reservation.status];

                  return (
                    <Tooltip key={reservation.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute left-1 right-1 rounded-md border px-2 py-1 cursor-pointer transition-all hover:shadow-md hover:z-10 overflow-hidden",
                            colorClass
                          )}
                          style={{ top: `${top}px`, height: `${height}px` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReservation(reservation);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusClass)} />
                            <span className="font-medium text-xs truncate">
                              {reservation.dog?.name}
                            </span>
                          </div>
                          {height > 40 && (
                            <p className="text-[10px] opacity-80 truncate mt-0.5">
                              {reservation.service?.name}
                            </p>
                          )}
                          {height > 60 && (
                            <p className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {format(new Date(reservation.startDate), "HH:mm")} -{" "}
                              {format(new Date(reservation.endDate), "HH:mm")}
                            </p>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Dog className="h-4 w-4" />
                            <span className="font-semibold">{reservation.dog?.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {reservation.customer?.firstName} {reservation.customer?.lastName}
                          </p>
                          <p className="text-sm">{reservation.service?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(reservation.startDate), "HH:mm")} -{" "}
                            {format(new Date(reservation.endDate), "HH:mm")}
                          </p>
                          {reservation.notes && (
                            <p className="text-xs italic">{reservation.notes}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
