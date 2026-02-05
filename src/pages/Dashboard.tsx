import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KPICard } from "@/components/dashboard/KPICard";
import { OpsTabs, OpsTab } from "@/components/dashboard/OpsTabs";
import { OpsTable } from "@/components/dashboard/OpsTable";
import { NoticesList } from "@/components/dashboard/NoticesList";
import { QuickFilters } from "@/components/dashboard/QuickFilters";
import { Button } from "@/components/ui/button";
import {
  getPopulatedReservations,
  mockNotices,
} from "@/data/mockData";
import {
  ReservationStatus,
  ServiceType,
  FlagType,
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
  const [activeTab, setActiveTab] = useState<OpsTab>("expected");
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [flagFilter, setFlagFilter] = useState<FlagType | "all">("all");

  const reservations = useMemo(() => getPopulatedReservations(), []);

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
      expected: todayReservations.filter(
        (r) => r.status === ReservationStatus.SCHEDULED
      ).length,
      checkedIn: todayReservations.filter(
        (r) =>
          r.status === ReservationStatus.CHECKED_IN ||
          r.status === ReservationStatus.IN_PROGRESS
      ).length,
      goingHome: todayReservations.filter(
        (r) =>
          r.status === ReservationStatus.READY ||
          (r.status === ReservationStatus.CHECKED_IN &&
            format(r.endDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
      ).length,
      overnight: reservations.filter(
        (r) => r.status === ReservationStatus.IN_PROGRESS
      ).length,
      total: todayReservations.length,
    };
  }, [reservations]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      notices: mockNotices.filter((n) => !n.isRead).length,
      expected: reservations.filter(
        (r) => r.status === ReservationStatus.SCHEDULED
      ).length,
      goingHome: reservations.filter(
        (r) =>
          r.status === ReservationStatus.READY ||
          r.status === ReservationStatus.CHECKED_IN
      ).length,
      checkedIn: reservations.filter(
        (r) =>
          r.status === ReservationStatus.CHECKED_IN ||
          r.status === ReservationStatus.IN_PROGRESS
      ).length,
      requested: reservations.filter(
        (r) => r.status === ReservationStatus.REQUESTED
      ).length,
    };
  }, [reservations]);

  // Filter reservations based on active tab
  const filteredReservations = useMemo(() => {
    let filtered = reservations;

    // Filter by tab
    switch (activeTab) {
      case "expected":
        filtered = filtered.filter(
          (r) => r.status === ReservationStatus.SCHEDULED
        );
        break;
      case "going-home":
        filtered = filtered.filter(
          (r) =>
            r.status === ReservationStatus.READY ||
            r.status === ReservationStatus.CHECKED_IN
        );
        break;
      case "checked-in":
        filtered = filtered.filter(
          (r) =>
            r.status === ReservationStatus.CHECKED_IN ||
            r.status === ReservationStatus.IN_PROGRESS
        );
        break;
      case "requested":
        filtered = filtered.filter(
          (r) => r.status === ReservationStatus.REQUESTED
        );
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.dog?.name.toLowerCase().includes(query) ||
          r.customer?.firstName.toLowerCase().includes(query) ||
          r.customer?.lastName.toLowerCase().includes(query)
      );
    }

    // Service filter
    if (serviceFilter !== "all") {
      filtered = filtered.filter((r) => r.service?.type === serviceFilter);
    }

    // Flag filter
    if (flagFilter !== "all") {
      filtered = filtered.filter((r) =>
        r.dog?.flags.some((f) => f.type === flagFilter)
      );
    }

    return filtered;
  }, [activeTab, reservations, searchQuery, serviceFilter, flagFilter]);

  const handleCheckIn = (reservationId: string) => {
    toast.success("Check-in completado", {
      description: "La mascota ha sido registrada correctamente.",
    });
  };

  const handleCheckOut = (reservationId: string) => {
    toast.success("Check-out completado", {
      description: "La mascota ha sido marcada para recoger.",
    });
  };

  const handleView = (reservationId: string) => {
    toast.info("Abriendo reserva...");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setServiceFilter("all");
    setFlagFilter("all");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Operaciones</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Ver calendario
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Nueva reserva
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          label="Esperados"
          value={kpis.expected}
          icon={Users}
          variant="info"
        />
        <KPICard
          label="Registrados"
          value={kpis.checkedIn}
          icon={LogIn}
          variant="success"
        />
        <KPICard
          label="Salen Hoy"
          value={kpis.goingHome}
          icon={LogOut}
          variant="warning"
        />
        <KPICard
          label="Internados"
          value={kpis.overnight}
          icon={Moon}
          variant="primary"
        />
        <KPICard
          label="Total Activos"
          value={kpis.total}
          icon={Activity}
          trend={{ value: 12, isPositive: true }}
        />
      </div>

      {/* Tabs */}
      <OpsTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />

      {/* Content based on active tab */}
      {activeTab === "notices" ? (
        <div className="max-w-3xl">
          <NoticesList
            notices={mockNotices}
            onAction={(action, params) => {
              toast.info(`Acción: ${action}`);
            }}
          />
        </div>
      ) : (
        <>
          {/* Quick Filters */}
          <QuickFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            serviceFilter={serviceFilter}
            onServiceChange={setServiceFilter}
            flagFilter={flagFilter}
            onFlagChange={setFlagFilter}
            onClearFilters={clearFilters}
          />

          {/* Operations Table */}
          <OpsTable
            reservations={filteredReservations}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onView={handleView}
          />
        </>
      )}
    </div>
  );
}
