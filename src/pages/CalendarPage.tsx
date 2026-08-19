import { useState, useEffect, useMemo, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { Reservation } from "@/types";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
} from "date-fns";
import { fetchReservationsRange, mapDbToReservation } from "@/hooks/useReservations";

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [newReservationDate, setNewReservationDate] = useState<Date | undefined>(undefined);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

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

  const visibleReservations = useMemo(() => {
    let start: Date;
    let end: Date;
    if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return allReservations.filter((r) =>
      isWithinInterval(new Date(r.startDate), { start, end })
    );
  }, [allReservations, currentDate, view]);

  const openNewReservation = (date?: Date) => {
    setNewReservationDate(date);
    setNewReservationOpen(true);
  };

  const handleSelectDay = (date: Date) => {
    setCurrentDate(date);
    setView("week");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onNewReservation={() => openNewReservation()}
        reservationCount={visibleReservations.length}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-[520px] w-full rounded-lg" />
        </div>
      ) : view === "week" ? (
        <WeekView
          currentDate={currentDate}
          reservations={visibleReservations}
          onSelectReservation={setEditingReservation}
          onSelectSlot={openNewReservation}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          reservations={visibleReservations}
          onSelectReservation={setEditingReservation}
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
    </div>
  );
}
