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
import { ServiceType } from "@/types";
import { CalendarEvent } from "./calendarEvent";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/worker";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dog, ClipboardList } from "lucide-react";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
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
  events,
  onSelectEvent,
  onSelectDay,
}: MonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    calendarDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = events.filter((e) => isSameDay(e.startDate, day));
    });
    return grouped;
  }, [events, calendarDays]);

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
              const dayEvents = eventsByDay[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const displayedEvents = dayEvents.slice(0, 3);
              const remainingCount = dayEvents.length - 3;

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

                  {/* Events */}
                  <div className="space-y-1">
                    {displayedEvents.map((event) => {
                      const isTask = event.kind === "task";
                      const dotColor = isTask
                        ? "bg-muted-foreground"
                        : serviceColorsDot[event.reservation?.service?.type || ServiceType.DAYCARE];
                      const primaryLabel = isTask ? (event.task!.dogName ?? event.task!.title) : event.reservation!.dog?.name;
                      const secondaryLabel = isTask
                        ? (TASK_TYPE_LABELS[event.task!.type as TaskType] ?? event.task!.type)
                        : event.reservation!.service?.name;

                      return (
                        <Tooltip key={`${event.kind}-${event.id}`}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs bg-muted/60 hover:bg-muted cursor-pointer truncate"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(event);
                              }}
                            >
                              {isTask ? (
                                <ClipboardList className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                              ) : (
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
                              )}
                              <span className="truncate font-medium">
                                {primaryLabel}
                              </span>
                              <span className="text-muted-foreground ml-auto">
                                {format(event.startDate, "HH:mm")}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {isTask ? <ClipboardList className="h-4 w-4" /> : <Dog className="h-4 w-4" />}
                                <span className="font-semibold">{primaryLabel}</span>
                              </div>
                              <p className="text-sm">{secondaryLabel}</p>
                              {event.zoneName && (
                                <p className="text-xs text-muted-foreground">Área: {event.zoneName}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {format(event.startDate, "HH:mm")} - {format(event.endDate, "HH:mm")}
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
