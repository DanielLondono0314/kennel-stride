import { useState, useMemo, useCallback, useEffect } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useReservations } from "@/hooks/useReservations";
import { KPICard } from "@/components/dashboard/KPICard";
import { OpsTabs, OpsTab } from "@/components/dashboard/OpsTabs";
import { OpsTable } from "@/components/dashboard/OpsTable";
import { NoticesList } from "@/components/dashboard/NoticesList";
import { QuickFilters } from "@/components/dashboard/QuickFilters";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { CheckOutModal } from "@/components/checkin/CheckOutModal";
import { Button } from "@/components/ui/button";
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

function mapDbNotice(n: any): Notice {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    severity: (n.severity as NoticeSeverity) ?? NoticeSeverity.INFO,
    isRead: n.is_read ?? false,
    entityType: n.entity_type ?? undefined,
    entityId: n.entity_id ?? undefined,
    suggestedActions: n.suggested_actions ?? undefined,
    createdAt: new Date(n.created_at),
  };
}

export default function Dashboard() {
  const orgNavigate = useOrgNavigate();
  const { organization } = useOrganization();
  const [activeTab, setActiveTab] = useState<OpsTab>("expected");
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [flagFilter, setFlagFilter] = useState<FlagType | "all">("all");

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  // Real reservations from Supabase with auto-refresh
  const { reservations, loading, checkIn, checkOut, approve, cancel, refetch } = useReservations({
    autoRefresh: true,
  });

  // Notices from Supabase
  const [notices, setNotices] = useState<Notice[]>([]);
  const fetchNotices = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from("notices")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotices(data.map(mapDbNotice));
  }, [organization?.id]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  // Real-time subscription for notices
  useEffect(() => {
    if (!organization) return;
    const channel = supabase
      .channel(`notices-dashboard-${organization.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notices", filter: `organization_id=eq.${organization.id}` }, fetchNotices)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotices, organization?.id]);

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
        r.status === ReservationStatus.CHECKED_IN
      ).length,
      overnight: reservations.filter((r) => r.status === ReservationStatus.IN_PROGRESS).length,
      total: today.length,
    };
  }, [reservations]);

  const tabCounts = useMemo(() => ({
    notices: notices.filter((n) => !n.isRead).length,
    expected: reservations.filter((r) => r.status === ReservationStatus.SCHEDULED).length,
    goingHome: reservations.filter((r) =>
      r.status === ReservationStatus.READY || r.status === ReservationStatus.CHECKED_IN
    ).length,
    checkedIn: reservations.filter((r) =>
      r.status === ReservationStatus.CHECKED_IN || r.status === ReservationStatus.IN_PROGRESS
    ).length,
    requested: reservations.filter((r) => r.status === ReservationStatus.REQUESTED).length,
  }), [reservations, notices]);

  const filteredReservations = useMemo(() => {
    let filtered = reservations.filter(
      (r) => r.status !== ReservationStatus.CANCELLED && r.status !== ReservationStatus.COMPLETED
    );
    switch (activeTab) {
      case "expected": filtered = filtered.filter((r) => r.status === ReservationStatus.SCHEDULED); break;
      case "going-home": filtered = filtered.filter((r) =>
        r.status === ReservationStatus.READY || r.status === ReservationStatus.CHECKED_IN
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
    const { error } = await checkIn(data.reservationId);
    setCheckInModalOpen(false);
    if (error) {
      toast.error("Error al registrar check-in");
    } else {
      toast.success("Check-in completado", {
        description: `${selectedReservation?.dog?.name} ha sido registrado.`,
      });
    }
    setSelectedReservation(null);
  };

  const handleCheckOutConfirm = async (data: { reservationId: string }) => {
    const { error } = await checkOut(data.reservationId);
    setCheckOutModalOpen(false);
    if (error) {
      toast.error("Error al registrar check-out");
    } else {
      toast.success("Check-out completado", {
        description: `${selectedReservation?.dog?.name} ha salido del centro.`,
      });
    }
    setSelectedReservation(null);
  };

  const handleApprove = async (id: string) => {
    const r = reservations.find((r) => r.id === id);
    const { error } = await approve(id);
    if (error) {
      toast.error("Error al aprobar reserva");
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

  const handleDismissNotice = async (noticeId: string) => {
    await supabase
      .from("notices")
      .update({ is_dismissed: true })
      .eq("id", noticeId);
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
  };

  const handleMarkNoticeRead = async (noticeId: string) => {
    await supabase.from("notices").update({ is_read: true }).eq("id", noticeId);
    setNotices((prev) => prev.map((n) => (n.id === noticeId ? { ...n, isRead: true } : n)));
  };

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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <KPICard label="Esperados" value={kpis.expected} icon={Users} variant="info" />
        <KPICard label="Registrados" value={kpis.checkedIn} icon={LogIn} variant="success" />
        <KPICard label="Salen Hoy" value={kpis.goingHome} icon={LogOut} variant="warning" />
        <KPICard label="Internados" value={kpis.overnight} icon={Moon} variant="primary" />
        <KPICard label="Total Activos" value={kpis.total} icon={Activity} trend={{ value: 0, isPositive: true }} />
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
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              Cargando reservas...
            </div>
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
