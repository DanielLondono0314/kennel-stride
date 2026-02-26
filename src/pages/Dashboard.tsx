import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KPICard } from "@/components/dashboard/KPICard";
import { OpsTabs, OpsTab } from "@/components/dashboard/OpsTabs";
import { OpsTable } from "@/components/dashboard/OpsTable";
import { NoticesList } from "@/components/dashboard/NoticesList";
import { QuickFilters } from "@/components/dashboard/QuickFilters";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { CheckOutModal } from "@/components/checkin/CheckOutModal";
import { ReservationModal } from "@/components/calendar/ReservationModal";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getPopulatedReservations,
  mockNotices,
} from "@/data/mockData";
import {
  Reservation,
  ReservationStatus,
  ServiceType,
  FlagType,
  CheckInData,
  CheckOutData,
  Notice,
} from "@/types";
import {
  Users,
  LogIn,
  LogOut,
  Moon,
  Activity,
  Plus,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OpsTab>("expected");
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [flagFilter, setFlagFilter] = useState<FlagType | "all">("all");
  
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Cancel confirmation
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  // Mutable state for reservations and notices
  const [reservations, setReservations] = useState<Reservation[]>(() => getPopulatedReservations());
  const [notices, setNotices] = useState<Notice[]>(() => [...mockNotices]);

  // Helper to update a reservation's status
  const updateReservationStatus = useCallback((id: string, status: ReservationStatus, extra?: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status, ...extra, updatedAt: new Date() } : r));
  }, []);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const today = new Date();
    const todayReservations = reservations.filter(
      (r) =>
        format(r.startDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") ||
        (r.status === ReservationStatus.IN_PROGRESS &&
          r.startDate <= today &&
          r.endDate >= today)
    );

    return {
      expected: todayReservations.filter((r) => r.status === ReservationStatus.SCHEDULED).length,
      checkedIn: todayReservations.filter((r) => r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS).length,
      goingHome: todayReservations.filter((r) => r.status === ReservationStatus.READY || (r.status === ReservationStatus.CHECKED_IN && format(r.endDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))).length,
      overnight: reservations.filter((r) => r.status === ReservationStatus.IN_PROGRESS).length,
      total: todayReservations.length,
    };
  }, [reservations]);

  const tabCounts = useMemo(() => ({
    notices: notices.filter((n) => !n.isRead).length,
    expected: reservations.filter((r) => r.status === ReservationStatus.SCHEDULED).length,
    goingHome: reservations.filter((r) => r.status === ReservationStatus.READY || r.status === ReservationStatus.CHECKED_IN).length,
    checkedIn: reservations.filter((r) => r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS).length,
    requested: reservations.filter((r) => r.status === ReservationStatus.REQUESTED).length,
  }), [reservations, notices]);

  const filteredReservations = useMemo(() => {
    let filtered = reservations.filter(r => r.status !== ReservationStatus.CANCELLED && r.status !== ReservationStatus.COMPLETED);
    switch (activeTab) {
      case "expected": filtered = filtered.filter((r) => r.status === ReservationStatus.SCHEDULED); break;
      case "going-home": filtered = filtered.filter((r) => r.status === ReservationStatus.READY || r.status === ReservationStatus.CHECKED_IN); break;
      case "checked-in": filtered = filtered.filter((r) => r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS); break;
      case "requested": filtered = filtered.filter((r) => r.status === ReservationStatus.REQUESTED); break;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.dog?.name.toLowerCase().includes(query) || r.customer?.firstName.toLowerCase().includes(query) || r.customer?.lastName.toLowerCase().includes(query));
    }
    if (serviceFilter !== "all") filtered = filtered.filter((r) => r.service?.type === serviceFilter);
    if (flagFilter !== "all") filtered = filtered.filter((r) => r.dog?.flags.some((f) => f.type === flagFilter));
    return filtered;
  }, [activeTab, reservations, searchQuery, serviceFilter, flagFilter]);

  const handleCheckIn = (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) { setSelectedReservation(reservation); setCheckInModalOpen(true); }
  };

  const handleCheckOut = (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) { setSelectedReservation(reservation); setCheckOutModalOpen(true); }
  };

  const handleCheckInConfirm = (data: CheckInData) => {
    updateReservationStatus(data.reservationId, ReservationStatus.CHECKED_IN, { checkInTime: new Date() });
    setCheckInModalOpen(false);
    toast.success("Check-in completado", { description: `${selectedReservation?.dog?.name} ha sido registrado correctamente.` });
    setSelectedReservation(null);
  };

  const handleCheckOutConfirm = (data: CheckOutData) => {
    updateReservationStatus(data.reservationId, ReservationStatus.PICKED_UP, { checkOutTime: new Date() });
    setCheckOutModalOpen(false);
    const labels: Record<string, string> = { package: "con paquete", cash: "en efectivo", card: "con tarjeta", invoice: "a factura" };
    toast.success("Check-out completado", { description: `${selectedReservation?.dog?.name} ha salido. Pago ${labels[data.paymentMethod || 'cash']}.` });
    setSelectedReservation(null);
  };

  const handleView = (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) { setSelectedReservation(reservation); setReservationModalOpen(true); }
  };

  const handleApprove = (reservationId: string) => {
    updateReservationStatus(reservationId, ReservationStatus.SCHEDULED);
    const res = reservations.find(r => r.id === reservationId);
    toast.success("Reserva aprobada", { description: `La reserva de ${res?.dog?.name || 'perro'} ha sido programada.` });
    // Remove related notice
    setNotices(prev => prev.filter(n => !(n.entityType === 'reservation' && n.entityId === reservationId)));
  };

  const handleCancelRequest = (reservationId: string) => {
    setCancelTargetId(reservationId);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (cancelTargetId) {
      updateReservationStatus(cancelTargetId, ReservationStatus.CANCELLED);
      const res = reservations.find(r => r.id === cancelTargetId);
      toast.success("Reserva cancelada", { description: `La reserva de ${res?.dog?.name || 'perro'} ha sido cancelada.` });
    }
    setCancelDialogOpen(false);
    setCancelTargetId(null);
  };

  const handleDismissNotice = (noticeId: string) => {
    setNotices(prev => prev.filter(n => n.id !== noticeId));
    toast.info("Aviso eliminado");
  };

  const handleMarkNoticeRead = (noticeId: string) => {
    setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, isRead: true } : n));
  };

  const handleNoticeAction = (action: string, params?: Record<string, string>) => {
    switch (action) {
      case "navigate":
        if (params?.path) navigate(params.path);
        break;
      case "approve":
        if (params?.reservationId) handleApprove(params.reservationId);
        break;
      case "reject":
        if (params?.reservationId) {
          updateReservationStatus(params.reservationId, ReservationStatus.CANCELLED);
          setNotices(prev => prev.filter(n => !(n.entityType === 'reservation' && n.entityId === params.reservationId)));
          toast.info("Reserva rechazada");
        }
        break;
      case "contact":
        toast.info("Abriendo contacto del cliente...");
        break;
      case "sendReminder":
        toast.success("Recordatorio enviado al cliente");
        // Mark notice as read
        break;
      default:
        toast.info(`Acción: ${action}`);
    }
  };

  const handleReservationSave = (data: Partial<Reservation>) => {
    if (data.id) {
      setReservations(prev => prev.map(r => r.id === data.id ? { ...r, ...data, updatedAt: new Date() } : r));
    }
    setReservationModalOpen(false);
    setSelectedReservation(null);
    toast.success(data.id ? "Reserva actualizada" : "Reserva creada", { description: "Los cambios se han guardado correctamente." });
  };

  const clearFilters = () => { setSearchQuery(""); setServiceFilter("all"); setFlagFilter("all"); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Operaciones</h1>
          <p className="text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/calendar")}>
            <Calendar className="h-4 w-4 mr-2" />
            Ver calendario
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setSelectedReservation(null); setReservationModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva reserva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Esperados" value={kpis.expected} icon={Users} variant="info" />
        <KPICard label="Registrados" value={kpis.checkedIn} icon={LogIn} variant="success" />
        <KPICard label="Salen Hoy" value={kpis.goingHome} icon={LogOut} variant="warning" />
        <KPICard label="Internados" value={kpis.overnight} icon={Moon} variant="primary" />
        <KPICard label="Total Activos" value={kpis.total} icon={Activity} trend={{ value: 12, isPositive: true }} />
      </div>

      <OpsTabs activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />

      {activeTab === "notices" ? (
        <div className="max-w-3xl">
          <NoticesList notices={notices} onAction={handleNoticeAction} onDismiss={handleDismissNotice} onMarkRead={handleMarkNoticeRead} />
        </div>
      ) : (
        <>
          <QuickFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} serviceFilter={serviceFilter} onServiceChange={setServiceFilter} flagFilter={flagFilter} onFlagChange={setFlagFilter} onClearFilters={clearFilters} />
          <OpsTable
            reservations={filteredReservations}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onView={handleView}
            onApprove={handleApprove}
            onCancel={handleCancelRequest}
          />
        </>
      )}

      <CheckInModal reservation={selectedReservation} open={checkInModalOpen} onOpenChange={setCheckInModalOpen} onConfirm={handleCheckInConfirm} />
      <CheckOutModal reservation={selectedReservation} open={checkOutModalOpen} onOpenChange={setCheckOutModalOpen} onConfirm={handleCheckOutConfirm} />
      <ReservationModal reservation={selectedReservation} open={reservationModalOpen} onOpenChange={setReservationModalOpen} onSave={handleReservationSave} />
      
      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La reserva será marcada como cancelada y el cliente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, cancelar reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
