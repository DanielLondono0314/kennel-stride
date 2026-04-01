import { useState, useEffect, useMemo } from "react";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { Reservation } from "@/types";
import { toast } from "sonner";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
} from "date-fns";
import { fetchReservationsRange, mapDbToReservation } from "@/hooks/useReservations";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);

  // Fetch range whenever date or view changes
  useEffect(() => {
    let start: Date;
    let end: Date;
    if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    // Add a buffer month on each side so navigation feels instant
    const bufferedStart = new Date(start);
    bufferedStart.setMonth(bufferedStart.getMonth() - 1);
    const bufferedEnd = new Date(end);
    bufferedEnd.setMonth(bufferedEnd.getMonth() + 1);

    setLoading(true);
    fetchReservationsRange(bufferedStart, bufferedEnd).then((rows) => {
      setAllReservations(rows.map(mapDbToReservation));
      setLoading(false);
    });
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

  const handleNewReservation = () => {
    setSelectedReservation(null);
    setSelectedSlotDate(new Date());
    toast.info("Para crear reservas, usa el módulo de Solicitudes");
  };

  const handleSelectReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setSelectedSlotDate(null);
  };

  const handleSelectSlot = (date: Date) => {
    setSelectedReservation(null);
    setSelectedSlotDate(date);
    toast.info("Para crear reservas, usa el módulo de Solicitudes");
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
        onNewReservation={handleNewReservation}
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
          onSelectReservation={handleSelectReservation}
          onSelectSlot={handleSelectSlot}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          reservations={visibleReservations}
          onSelectReservation={handleSelectReservation}
          onSelectDay={handleSelectDay}
        />
      )}
    </div>
  );
}
