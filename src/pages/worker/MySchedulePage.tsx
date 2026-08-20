import { useMemo, useState } from "react";
import { useMyWeekSchedule, type ScheduleItem } from "@/hooks/queries/useMyWeekSchedule";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { STATUS_LABELS, reservationBucket } from "@/lib/worker";
import {
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, format, isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Pill, Leaf, ChevronLeft, ChevronRight } from "lucide-react";

export default function MySchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useOrgNavigate();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const { data = [], isLoading } = useMyWeekSchedule(weekStart, weekEnd);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of data) {
      if (!item.dayKey) continue;
      const list = map.get(item.dayKey) ?? [];
      list.push(item);
      map.set(item.dayKey, list);
    }
    return map;
  }, [data]);

  const undated = useMemo(() => data.filter((i) => !i.dayKey), [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mi Horario</h1>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md hover:bg-muted"
            onClick={() => setCurrentDate((d) => subWeeks(d, 1))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-muted"
            onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {undated.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Sin fecha</h2>
              {undated.map((item) => (
                <ScheduleRow key={`${item.kind}-${item.id}`} item={item} onClick={() => navigate(`/worker/${item.kind}/${item.id}`)} />
              ))}
            </section>
          )}

          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const items = itemsByDay.get(dayKey) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={dayKey} className="space-y-2">
                <h2 className={`text-sm font-medium ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEEE d 'de' MMMM", { locale: es })}
                </h2>
                {items.map((item) => (
                  <ScheduleRow key={`${item.kind}-${item.id}`} item={item} onClick={() => navigate(`/worker/${item.kind}/${item.id}`)} />
                ))}
              </section>
            );
          })}

          {data.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No tienes nada asignado esta semana.</p>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleRow({ item, onClick }: { item: ScheduleItem; onClick: () => void }) {
  const bucket = item.kind === "reservation" ? reservationBucket(item.status) : (item.status === "in_progress" ? "in_progress" : item.status === "pending" ? "pending" : "done");
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-lg border p-3 text-left">
      <div>
        <p className="font-medium">{item.dogName ?? item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.title}
          {item.time ? ` · ${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          {" · "}{STATUS_LABELS[bucket]}
        </p>
      </div>
      <div className="flex gap-1">
        {item.flags.aggressive && <AlertTriangle className="h-4 w-4 text-destructive" />}
        {item.flags.allergies && <Leaf className="h-4 w-4 text-amber-600" />}
        {item.flags.medication && <Pill className="h-4 w-4 text-info" />}
      </div>
    </button>
  );
}
