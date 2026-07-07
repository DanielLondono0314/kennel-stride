import { useState, useMemo } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { useUrlState } from "@/hooks/useUrlState";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useReservations } from "@/hooks/useReservations";
import { useNotices, useDismissNotice, useMarkNoticeRead, useNoticesRealtime } from "@/hooks/queries/useNotices";
import { OpsTabs, OpsTab } from "@/components/dashboard/OpsTabs";
import { OpsTable } from "@/components/dashboard/OpsTable";
import { NoticesList } from "@/components/dashboard/NoticesList";
import { QuickFilters } from "@/components/dashboard/QuickFilters";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { CheckOutModal } from "@/components/checkin/CheckOutModal";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Reservation, ReservationStatus, ServiceType, FlagType,
  CheckInData, Notice, NoticeSeverity,
} from "@/types";
import { Users, LogIn, LogOut, Moon, Activity, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

export default function Dashboard() {
  const orgNavigate = useOrgNavigate();
  const { organization } = useOrganization();
  const [activeTab, setActiveTab] = useUrlState<OpsTab>("tab", "expected");
  const [searchQuery, setSearchQuery] = useUrlState<string>("q", "");
  const [serviceFilter, setServiceFilter] = useUrlState<ServiceType | "all">("service", "all");
  const [flagFilter, setFlagFilter] = useUrlState<FlagType | "all">("flag", "all");

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  // Real reservations from Supabase with auto-refresh
  const { reservations, loading, error: reservationsError, checkIn, approve, cancel, refetch } = useReservations({
    autoRefresh: true,
  });

  // Notices from React Query hook
  const { data: notices = [] } = useNotices();
  useNoticesRealtime();
  const dismissNotice = useDismissNotice();
  const markRead = useMarkNoticeRead();

  // KPIs based on today's reservations
  const kpis = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const today = reservations.filter(
      (r) =>
        format(r.startDate, "yyyy-MM-dd") === todayStr ||
        (r.status === ReservationStatus.IN_PROGRESS && r.startDate <= new Date() && r.endDate >= new Date())
    );
    return {
      expected: today.filter((r) => r.status === ReservationStatus.SCHEDULED).length,
      checkedIn: today.filter((r) =>
        r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS
      ).length,
      goingHome: today.filter((r) =>
        r.status === ReservationStatus.READY ||
        (r.status === ReservationStatus.CHECKED_IN && format(r.endDate, "yyyy-MM-dd") === todayStr)
      ).length,
      overnight: reservations.filter((r) => r.status === ReservationStatus.IN_PROGRESS).length,
      total: today.length,
    };
  }, [reservations]);

  const tabCounts = useMemo(() => {
    // "Esperados Hoy" y "Salen Hoy" filtran por FECHA además de estado,
    // igual que los KPIs de arriba (antes el tab mostraba reservas de
    // mañana y contradecía al contador).
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return {
    notices: notices.filter((n) => !n.isRead).length,
    expected: reservations.filter((r) =>
      r.status === ReservationStatus.SCHEDULED && format(r.startDate, "yyyy-MM-dd") === todayStr
    ).length,
    goingHome: reservations.filter((r) =>
      r.status === ReservationStatus.READY ||
      (r.status === ReservationStatus.CHECKED_IN && format(r.endDate, "yyyy-MM-dd") === todayStr)
    ).length,
    checkedIn: reservations.filter((r) =>
      r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS
    ).length,
    requested: reservations.filter((r) => r.status === ReservationStatus.REQUESTED).length,
  }; }, [reservations, notices]);

  const filteredReservations = useMemo(() => {
    let filtered = reservations.filter(
      (r) => r.status !== ReservationStatus.CANCELLED && r.status !== ReservationStatus.COMPLETED
    );
    const todayStr = format(new Date(), "yyyy-MM-dd");
    switch (activeTab) {
      case "expected": filtered = filtered.filter((r) =>
        r.status === ReservationStatus.SCHEDULED && format(r.startDate, "yyyy-MM-dd") === todayStr
      ); break;
      case "going-home": filtered = filtered.filter((r) =>
        r.status === ReservationStatus.READY ||
        (r.status === ReservationStatus.CHECKED_IN && format(r.endDate, "yyyy-MM-dd") === todayStr)
      ); break;
      case "checked-in": filtered = filtered.filter((r) =>
        r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS
      ); break;
      case "requested": filtered = filtered.filter((r) => r.status === ReservationStatus.REQUESTED); break;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.dog?.name.toLowerCase().includes(q) ||
        r.customer?.firstName.toLowerCase().includes(q) ||
        r.customer?.lastName.toLowerCase().includes(q)
      );
    }
    if (serviceFilter !== "all") filtered = filtered.filter((r) => r.service?.type === serviceFilter);
    if (flagFilter !== "all") {
      filtered = filtered.filter((r) =>
        r.dog?.flags?.some((f) => f.type === flagFilter)
      );
    }
    return filtered;
  }, [activeTab, reservations, searchQuery, serviceFilter, flagFilter]);

  // --- Action handlers ---
  const handleCheckIn = (id: string) => {
    const r = reservations.find((r) => r.id === id);
    if (r) { setSelectedReservation(r); setCheckInModalOpen(true); }
  };

  const handleCheckOut = (id: string) => {
    const r = reservations.find((r) => r.id === id);
    if (r) { setSelectedReservation(r); setCheckOutModalOpen(true); }
  };

  const handleCheckInConfirm = async (data: CheckInData) => {
    const { error } = await checkIn(data.reservationId, data.unitId, data.notes);
    setCheckInModalOpen(false);
    if (error) {
      toast.error("No se pudo registrar el check-in", {
        description: error.message || "Inténtalo de nuevo.",
      });
    } else {
      toast.success("Check-in completado", {
        description: `${selectedReservation?.dog?.name} ha sido registrado.`,
      });
    }
    setSelectedReservation(null);
  };

  // El modal ya hizo TODO el check-out (pago + completitud + liberación de
  // perrera) vía el RPC atómico complete_checkout; aquí solo refrescamos.
  const handleCheckOutConfirm = async (_data: { reservationId: string }) => {
    setCheckOutModalOpen(false);
    toast.success("Check-out completado", {
      description: `${selectedReservation?.dog?.name} ha salido del centro.`,
    });
    setSelectedReservation(null);
    await refetch();
  };

  const handleApprove = async (id: string) => {
    const r = reservations.find((r) => r.id === id);
    const { error } = await approve(id);
    if (error) {
      toast.error("No se pudo aprobar la reserva", { description: "Inténtalo de nuevo." });
    } else {
      toast.success("Reserva aprobada", {
        description: `La reserva de ${r?.dog?.name ?? "perro"} ha sido programada.`,
      });
    }
  };

  const handleCancelRequest = (id: string) => {
    setCancelTargetId(id);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (cancelTargetId) {
      const r = reservations.find((r) => r.id === cancelTargetId);
      const { error } = await cancel(cancelTargetId);
      if (!error) {
        toast.success("Reserva cancelada", {
          description: `La reserva de ${r?.dog?.name ?? "perro"} ha sido cancelada.`,
        });
      }
    }
    setCancelDialogOpen(false);
    setCancelTargetId(null);
  };

  const handleDismissNotice = (noticeId: string) => dismissNotice.mutate(noticeId);
  const handleMarkNoticeRead = (noticeId: string) => markRead.mutate(noticeId);

  const handleNoticeAction = (action: string, params?: Record<string, string>) => {
    switch (action) {
      case "navigate":
        if (params?.path) orgNavigate(params.path);
        break;
      case "approve":
        if (params?.reservationId) handleApprove(params.reservationId);
        break;
      case "reject":
        if (params?.reservationId) cancel(params.reservationId).then(() => toast.info("Reserva rechazada"));
        break;
      case "contact":
        toast.info("Abriendo contacto del cliente...");
        break;
      case "sendReminder":
        toast.success("Recordatorio enviado al cliente");
        break;
      default:
        toast.info(`Acción: ${action}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Operaciones</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => orgNavigate("/calendar")}>
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Ver calendario</span>
            <span className="sm:hidden">Calendario</span>
          </Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setNewReservationOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nueva reserva</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      <OnboardingChecklist />

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex divide-x divide-border overflow-x-auto">
          {[
            { label: "Esperados", value: kpis.expected, icon: Users, tint: "bg-info/10 text-info" },
            { label: "Registrados", value: kpis.checkedIn, icon: LogIn, tint: "bg-success/10 text-success" },
            { label: "Salen hoy", value: kpis.goingHome, icon: LogOut, tint: "bg-warning/10 text-warning" },
            { label: "Internados", value: kpis.overnight, icon: Moon, tint: "bg-primary/10 text-primary" },
            { label: "Total activos", value: kpis.total, icon: Activity, tint: "bg-muted text-muted-foreground" },
          ].map(({ label, value, icon: Icon, tint }) => (
            <div key={label} className="flex flex-1 items-center gap-3 p-4 min-w-[8.5rem]">
              <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <OpsTabs activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />

      {activeTab === "notices" ? (
        <div className="max-w-3xl">
          <NoticesList
            notices={notices}
            onAction={handleNoticeAction}
            onDismiss={handleDismissNotice}
            onMarkRead={handleMarkNoticeRead}
          />
        </div>
      ) : (
        <>
          <QuickFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            serviceFilter={serviceFilter}
            onServiceChange={setServiceFilter}
            flagFilter={flagFilter}
            onFlagChange={setFlagFilter}
            onClearFilters={() => { setSearchQuery(""); setServiceFilter("all"); setFlagFilter("all"); }}
          />
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : reservationsError ? (
            <QueryErrorState
              title="No se pudieron cargar las reservas"
              description={reservationsError}
              onRetry={refetch}
            />
          ) : (
            <OpsTable
              reservations={filteredReservations}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onView={(id) => orgNavigate(`/requests?id=${id}`)}
              onApprove={handleApprove}
              onCancel={handleCancelRequest}
            />
          )}
        </>
      )}

      <NewReservationModal
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        onSaved={refetch}
      />

      <CheckInModal
        reservation={selectedReservation}
        open={checkInModalOpen}
        onOpenChange={setCheckInModalOpen}
        onConfirm={handleCheckInConfirm}
      />
      <CheckOutModal
        reservation={selectedReservation}
        open={checkOutModalOpen}
        onOpenChange={setCheckOutModalOpen}
        onConfirm={handleCheckOutConfirm}
      />

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La reserva será marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
