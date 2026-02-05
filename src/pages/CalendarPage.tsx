import { useState, useMemo } from "react";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ReservationModal } from "@/components/calendar/ReservationModal";
import { getPopulatedReservations } from "@/data/mockData";
import { Reservation, ReservationStatus } from "@/types";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);

  // Get all reservations
  const allReservations = useMemo(() => getPopulatedReservations(), []);

  // Filter reservations for current view range
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

    return allReservations.filter((r) => {
      const reservationDate = new Date(r.startDate);
      return isWithinInterval(reservationDate, { start, end });
    });
  }, [allReservations, currentDate, view]);

  const handleNewReservation = () => {
    setSelectedReservation(null);
    setSelectedSlotDate(new Date());
    setModalOpen(true);
  };

  const handleSelectReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setSelectedSlotDate(null);
    setModalOpen(true);
  };

  const handleSelectSlot = (date: Date) => {
    setSelectedReservation(null);
    setSelectedSlotDate(date);
    setModalOpen(true);
  };

  const handleSelectDay = (date: Date) => {
    // Switch to week view centered on selected day
    setCurrentDate(date);
    setView("week");
  };

  const handleSaveReservation = (data: Partial<Reservation>) => {
    setModalOpen(false);
    
    if (selectedReservation) {
      toast.success("Reserva actualizada", {
        description: "Los cambios han sido guardados correctamente.",
      });
    } else {
      toast.success("Reserva creada", {
        description: "La nueva reserva ha sido programada.",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with navigation and controls */}
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onNewReservation={handleNewReservation}
        reservationCount={visibleReservations.length}
      />

      {/* Calendar View */}
      {view === "week" ? (
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

      {/* Reservation Modal */}
      <ReservationModal
        reservation={selectedReservation}
        initialDate={selectedSlotDate}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSaveReservation}
      />
    </div>
  );
}
