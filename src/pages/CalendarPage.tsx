import { useState, useEffect, useMemo, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { useTasks } from "@/hooks/queries/useTasks";
import { useStaffMembers } from "@/hooks/queries/useStaffMembers";
import { useFacilityZones } from "@/hooks/queries/useFacilityZones";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { TaskDetailDialog } from "@/components/calendar/TaskDetailDialog";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { CalendarEvent, CalendarTask } from "@/components/calendar/calendarEvent";
import { Reservation } from "@/types";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
} from "date-fns";
import { fetchReservationsRange, mapDbToReservation } from "@/hooks/useReservations";

const RESERVATION_TYPE_OPTIONS = [
  { value: "daycare", label: "Guardería" },
  { value: "board_and_train", label: "Internado + Entrenamiento" },
  { value: "training_session", label: "Sesión de Entrenamiento" },
  { value: "grooming", label: "Estética / Grooming" },
  { value: "evaluation", label: "Evaluación" },
];

const TASK_TYPE_OPTIONS = [
  { value: "cleaning", label: "Aseo" },
  { value: "feeding", label: "Alimentación" },
  { value: "walk", label: "Paseo" },
  { value: "vet_check", label: "Chequeo veterinario" },
  { value: "grooming", label: "Grooming" },
  { value: "other", label: "Otro" },
];

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();
  const orgId = organization?.id;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [newReservationDate, setNewReservationDate] = useState<Date | undefined>(undefined);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  // Filtros admin: trabajador, área y tipo (servicio o tarea).
  const [staffFilter, setStaffFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: staffMembers = [] } = useStaffMembers();
  const { data: zones = [] } = useFacilityZones();
  const { data: tasksData = [] } = useTasks();

  const fetchRange = useCallback(() => {
    let start: Date;
    let end: Date;
    if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    const bufferedStart = new Date(start);
    bufferedStart.setMonth(bufferedStart.getMonth() - 1);
    const bufferedEnd = new Date(end);
    bufferedEnd.setMonth(bufferedEnd.getMonth() + 1);

    if (!orgId) return;
    setLoading(true);
    fetchReservationsRange(bufferedStart, bufferedEnd, orgId).then((rows) => {
      setAllReservations(rows.map(mapDbToReservation));
      setLoading(false);
    });
  }, [view, currentDate, orgId]);

  useEffect(() => {
    fetchRange();
  }, [fetchRange]);

  const visibleRange = useMemo(() => {
    if (view === "week") {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }, [currentDate, view]);

  // Reservas y tareas, unificadas en CalendarEvent para dibujarse en el mismo grid.
  const allEvents = useMemo((): CalendarEvent[] => {
    const reservationEvents: CalendarEvent[] = allReservations
      .filter((r) => isWithinInterval(new Date(r.startDate), visibleRange))
      .map((r) => ({
        id: r.id,
        kind: "reservation" as const,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        staffId: r.staff?.id ?? null,
        zoneName: null, // las reservas solo tienen perrera asignada tras check-in, no de entrada
        typeKey: r.service?.type ?? "",
        reservation: r,
      }));

    const taskEvents: CalendarEvent[] = (tasksData as any[])
      .filter((t) => !!t.due_at && isWithinInterval(new Date(t.due_at), visibleRange))
      .map((t): CalendarEvent => {
        const start = new Date(t.due_at);
        const end = new Date(start.getTime() + 30 * 60000);
        const staffName = t.staff_members ? `${t.staff_members.first_name} ${t.staff_members.last_name}` : null;
        return {
          id: t.id,
          kind: "task",
          startDate: start,
          endDate: end,
          staffId: t.assignee_staff_id ?? null,
          zoneName: t.facility_zones?.name ?? null,
          typeKey: t.type,
          task: {
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            dueAt: t.due_at,
            dogName: t.dogs?.name ?? null,
            staffId: t.assignee_staff_id ?? null,
            staffName,
            zoneId: t.zone_id ?? null,
            zoneName: t.facility_zones?.name ?? null,
            notes: t.notes ?? null,
          },
        };
      });

    return [...reservationEvents, ...taskEvents];
  }, [allReservations, tasksData, visibleRange]);

  const visibleEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (staffFilter !== "all" && e.staffId !== staffFilter) return false;
      if (zoneFilter !== "all") {
        const zoneName = zones.find((z) => z.id === zoneFilter)?.name;
        if (!zoneName || e.zoneName !== zoneName) return false;
      }
      if (typeFilter !== "all") {
        const [kind, value] = typeFilter.split(":");
        if (kind === "svc" && !(e.kind === "reservation" && e.typeKey === value)) return false;
        if (kind === "task" && !(e.kind === "task" && e.typeKey === value)) return false;
      }
      return true;
    });
  }, [allEvents, staffFilter, zoneFilter, typeFilter, zones]);

  const openNewReservation = (date?: Date) => {
    setNewReservationDate(date);
    setNewReservationOpen(true);
  };

  const handleSelectDay = (date: Date) => {
    setCurrentDate(date);
    setView("week");
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.kind === "reservation" && event.reservation) {
      setEditingReservation(event.reservation);
    } else if (event.kind === "task" && event.task) {
      setSelectedTask(event.task);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onNewReservation={() => openNewReservation()}
        reservationCount={visibleEvents.length}
      />

      {/* Filtros admin: trabajador, área, tipo */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />Filtrar por
        </span>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Trabajador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los trabajadores</SelectItem>
            {staffMembers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las áreas</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectGroup>
              <SelectLabel>Servicios</SelectLabel>
              {RESERVATION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={`svc:${o.value}`} value={`svc:${o.value}`}>{o.label}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Tareas</SelectLabel>
              {TASK_TYPE_OPTIONS.map((o) => (
                <SelectItem key={`task:${o.value}`} value={`task:${o.value}`}>{o.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-[520px] w-full rounded-lg" />
        </div>
      ) : view === "week" ? (
        <WeekView
          currentDate={currentDate}
          events={visibleEvents}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={openNewReservation}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          events={visibleEvents}
          onSelectEvent={handleSelectEvent}
          onSelectDay={(date) => {
            handleSelectDay(date);
            openNewReservation(date);
          }}
        />
      )}

      <NewReservationModal
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        initialDate={newReservationDate}
        onSaved={fetchRange}
      />

      <NewReservationModal
        open={!!editingReservation}
        onOpenChange={(o) => { if (!o) setEditingReservation(null); }}
        onSaved={fetchRange}
        editData={editingReservation ? {
          id: editingReservation.id,
          serviceType: editingReservation.service?.type ?? "daycare",
          startDate: editingReservation.startDate,
          endDate: editingReservation.endDate,
          totalPrice: editingReservation.totalPrice,
          notes: editingReservation.notes,
          status: editingReservation.status,
          dogName: editingReservation.dog?.name,
          customerName: `${editingReservation.customer?.firstName ?? ""} ${editingReservation.customer?.lastName ?? ""}`.trim(),
        } : undefined}
      />

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(o) => { if (!o) setSelectedTask(null); }}
        onViewInTasks={() => orgNavigate("/tasks")}
      />
    </div>
  );
}
