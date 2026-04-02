import { useState, useEffect, useMemo } from "react";
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [newReservationDate, setNewReservationDate] = useState<Date | undefined>(undefined);

  const fetchRange = () => {
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

    setLoading(true);
    fetchReservationsRange(bufferedStart, bufferedEnd).then((rows) => {
      setAllReservations(rows.map(mapDbToReservation));
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchRange();
  }, [view, currentDate.getFullYear(), currentDate.getMonth()]);

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
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Cargando calendario...
        </div>
      ) : view === "week" ? (
        <WeekView
          currentDate={currentDate}
          reservations={visibleReservations}
          onSelectReservation={() => {}}
          onSelectSlot={openNewReservation}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          reservations={visibleReservations}
          onSelectReservation={() => {}}
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
    </div>
  );
}
