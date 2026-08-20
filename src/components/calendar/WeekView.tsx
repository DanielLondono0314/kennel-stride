import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { ReservationStatus, ServiceType } from "@/types";
import { CalendarEvent } from "./calendarEvent";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/worker";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dog, Clock, ClipboardList } from "lucide-react";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
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

// Las tareas se distinguen visualmente de las reservas (borde punteado +
// icono de checklist) en vez de intentar mapear su tipo a la paleta de
// servicios, que no les aplica.
const taskColorClass = "bg-muted border-dashed border-muted-foreground/50 text-foreground";

export function WeekView({
  currentDate,
  events,
  onSelectEvent,
  onSelectSlot,
}: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = events.filter((e) => isSameDay(e.startDate, day));
    });
    return grouped;
  }, [events, weekDays]);

  const calculateEventPosition = (event: CalendarEvent) => {
    const startHour = getHours(event.startDate) + getMinutes(event.startDate) / 60;
    const endHour = getHours(event.endDate) + getMinutes(event.endDate) / 60;

    const top = (startHour - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 24);

    return { top, height };
  };

  // Empaqueta los eventos de un día en columnas para que los que se solapan en
  // horario queden lado a lado en vez de uno encima de otro.
  const layoutDayEvents = (dayEvents: CalendarEvent[]) => {
    const sorted = [...dayEvents].sort((a, b) => {
      const startDiff = a.startDate.getTime() - b.startDate.getTime();
      if (startDiff !== 0) return startDiff;
      return b.endDate.getTime() - a.endDate.getTime();
    });

    type Positioned = { event: CalendarEvent; col: number; totalCols: number };
    const result: Positioned[] = [];
    let cluster: Positioned[] = [];
    let clusterEnd = -Infinity;
    let columnsEnd: number[] = [];

    const flushCluster = () => {
      if (cluster.length === 0) return;
      const maxCols = Math.max(...cluster.map((p) => p.col)) + 1;
      cluster.forEach((p) => { p.totalCols = maxCols; });
      result.push(...cluster);
      cluster = [];
    };

    for (const e of sorted) {
      const start = e.startDate.getTime();
      const end = e.endDate.getTime();

      if (start >= clusterEnd) {
        flushCluster();
        columnsEnd = [];
        clusterEnd = -Infinity;
      }

      let col = columnsEnd.findIndex((c) => c <= start);
      if (col === -1) {
        col = columnsEnd.length;
        columnsEnd.push(end);
      } else {
        columnsEnd[col] = end;
      }

      clusterEnd = Math.max(clusterEnd, end);
      cluster.push({ event: e, col, totalCols: 1 });
    }
    flushCluster();

    return result;
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
            const dayEvents = eventsByDay[dayKey] || [];

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

                {/* Events */}
                {layoutDayEvents(dayEvents).map(({ event, col, totalCols }) => {
                  const { top, height } = calculateEventPosition(event);
                  const isTask = event.kind === "task";
                  const colorClass = isTask
                    ? taskColorClass
                    : serviceColors[event.reservation?.service?.type || ServiceType.DAYCARE];
                  const statusClass = isTask ? undefined : statusIndicators[event.reservation!.status];
                  const widthPct = 100 / totalCols;
                  const leftPct = col * widthPct;

                  const primaryLabel = isTask ? (event.task!.dogName ?? event.task!.title) : event.reservation!.dog?.name;
                  const secondaryLabel = isTask
                    ? (TASK_TYPE_LABELS[event.task!.type as TaskType] ?? event.task!.type)
                    : event.reservation!.service?.name;

                  return (
                    <Tooltip key={`${event.kind}-${event.id}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute rounded-md border px-2 py-1 cursor-pointer transition-all hover:shadow-md hover:z-20 overflow-hidden",
                            colorClass
                          )}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {isTask ? (
                              <ClipboardList className="h-2.5 w-2.5 flex-shrink-0" />
                            ) : (
                              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusClass)} />
                            )}
                            <span className="font-medium text-xs truncate">
                              {primaryLabel}
                            </span>
                          </div>
                          {height > 40 && (
                            <p className="text-[10px] opacity-80 truncate mt-0.5">
                              {secondaryLabel}
                            </p>
                          )}
                          {height > 60 && (
                            <p className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {format(event.startDate, "HH:mm")} - {format(event.endDate, "HH:mm")}
                            </p>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isTask ? <ClipboardList className="h-4 w-4" /> : <Dog className="h-4 w-4" />}
                            <span className="font-semibold">{primaryLabel}</span>
                          </div>
                          {!isTask && (
                            <p className="text-sm text-muted-foreground">
                              {event.reservation?.customer?.firstName} {event.reservation?.customer?.lastName}
                            </p>
                          )}
                          <p className="text-sm">{secondaryLabel}</p>
                          {event.zoneName && (
                            <p className="text-xs text-muted-foreground">Área: {event.zoneName}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(event.startDate, "HH:mm")} - {format(event.endDate, "HH:mm")}
                          </p>
                          {!isTask && event.reservation?.notes && (
                            <p className="text-xs italic">{event.reservation.notes}</p>
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
