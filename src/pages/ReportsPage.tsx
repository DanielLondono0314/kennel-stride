import { useState, useMemo } from "react";
import { useReportsData, DateRange } from "@/hooks/queries/useReportsData";
import { useAdminSummary } from "@/hooks/queries/useAdminSummary";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, TrendingUp, DollarSign, Users, PawPrint, BarChart3, PieChart as PieChartIcon, Activity,
  ShieldCheck, Warehouse, UserCog, ClipboardList, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { parseDateOnly } from "@/lib/age";
import { PLAN_STATE_LABELS, isCurrent, planState, type DogPlan } from "@/lib/dogPlans";
import { STAFF_ROLE_LABELS } from "@/lib/worker";

type ReportPlan = DogPlan & { customers: { first_name: string; last_name: string } | null };

const COLORS = [
  "hsl(38, 92%, 50%)", "hsl(222, 47%, 20%)", "hsl(142, 76%, 36%)",
  "hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)", "hsl(0, 84%, 60%)",
];

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>("30d");
  const basePath = useOrgBasePath();

  const { data, isLoading } = useReportsData(range);
  const { data: adminSummary, isLoading: adminLoading } = useAdminSummary();

  const invoices = data?.invoices ?? [];
  const newCustomers = data?.newCustomers ?? [];
  const plans = useMemo(() => (data?.plans ?? []) as unknown as ReportPlan[], [data?.plans]);
  const units = data?.units ?? [];
  const reportCards = data?.reportCards ?? [];
  const reservations = data?.reservations ?? [];

  // Data already filtered server-side — use directly
  const filteredInvoices = invoices;
  const filteredReservations = reservations;

  // Reservations by service type
  const reservationsByService = useMemo(() => {
    const serviceLabels: Record<string, string> = {
      daycare: "Guardería", board_and_train: "Internado",
      training_session: "Sesión", grooming: "Grooming", evaluation: "Evaluación",
    };
    const counts: Record<string, number> = {};
    filteredReservations.forEach((r) => {
      const label = serviceLabels[r.service_type] ?? r.service_type;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReservations]);

  // Reservations by status
  const reservationsByStatus = useMemo(() => {
    const statusLabels: Record<string, string> = {
      requested: "Solicitadas", scheduled: "Programadas", checked_in: "En curso",
      completed: "Completadas", cancelled: "Canceladas", no_show: "No se presentó",
    };
    const counts: Record<string, number> = {};
    filteredReservations.forEach((r) => {
      const label = statusLabels[r.status] ?? r.status;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReservations]);

  // KPIs — los ingresos cobrados incluyen facturas pagadas Y planes vendidos
  // en el período (un check-out cubierto por un plan no factura: el cobro fue la venta).
  const RANGE_DAYS: Record<string, number> = { "30d": 30, "90d": 90, "6m": 183, "1y": 365 };
  const rangeCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (RANGE_DAYS[range] ?? 30));
    return d;
  }, [range]);
  const cutoffDay = format(rangeCutoff, "yyyy-MM-dd");
  const soldPlans = useMemo(
    () => plans.filter((p) => p.status !== "cancelled" && p.sold_on >= cutoffDay && Number(p.price) > 0),
    [plans, cutoffDay]
  );
  const planRevenue = soldPlans.reduce((s, p) => s + Number(p.price), 0);
  const totalRevenue = filteredInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0) + planRevenue;
  const totalPending = filteredInvoices.filter((i) => i.status === "pending" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
  const activeCustomers = newCustomers.length;
  const occupiedKennels = units.filter((u: any) => u.status === "occupied").length;
  const totalKennels = units.length;
  // Disponibles = libres de verdad; las que están en mantenimiento no cuentan (QA E-04).
  const availableKennels = units.filter((u: any) => u.status === "available").length;
  const occupancyRate = totalKennels > 0 ? Math.round((occupiedKennels / totalKennels) * 100) : 0;
  const totalReservations = filteredReservations.length;
  const completedReservations = filteredReservations.filter((r) => r.status === "completed").length;
  const conversionRate = totalReservations > 0 ? Math.round((completedReservations / totalReservations) * 100) : 0;

  // Revenue by month chart
  const revenueByMonth = useMemo(() => {
    // Clave ordenable (yyyy-MM) y etiqueta legible; facturas pagadas + planes vendidos.
    const months = new Map<string, { name: string; ingresos: number }>();
    const add = (d: Date, amount: number) => {
      const key = format(d, "yyyy-MM");
      const m = months.get(key) ?? { name: format(d, "MMM yy", { locale: es }), ingresos: 0 };
      m.ingresos += amount;
      months.set(key, m);
    };
    filteredInvoices.filter((i) => i.status === "paid").forEach((inv) => add(new Date(inv.created_at), Number(inv.total)));
    soldPlans.forEach((p) => add(parseDateOnly(p.sold_on), Number(p.price)));
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredInvoices, soldPlans]);

  // Invoice status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInvoices.forEach((i) => {
      const label = i.status === "paid" ? "Pagadas" : i.status === "pending" ? "Pendientes" : i.status === "overdue" ? "Vencidas" : "Canceladas";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  // Estado de los planes (vigente, por vencer, vencido, agotado…)
  const planBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    plans.forEach((p) => {
      const label = PLAN_STATE_LABELS[planState(p)];
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [plans]);
  const activePlans = plans.filter((p) => isCurrent(planState(p))).length;

  // Top customers — built from invoices with customer_id
  const topCustomers = useMemo(() => {
    const spending: Record<string, { name: string; total: number }> = {};
    const add = (id: string | null, who: { first_name: string; last_name: string } | null, amount: number) => {
      if (!id) return;
      spending[id] ??= { name: who ? `${who.first_name} ${who.last_name}`.trim() : "Cliente", total: 0 };
      spending[id].total += amount;
    };
    filteredInvoices
      .filter((i) => i.status === "paid")
      .forEach((inv) => add(inv.customer_id, inv.customers, Number(inv.total)));
    soldPlans.forEach((p) => add(p.customer_id, p.customers, Number(p.price)));
    return Object.values(spending).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredInvoices, soldPlans]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Análisis financiero y operativo del centro</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
          <SelectTrigger className="w-44 self-start sm:self-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="1y">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Ingresos Cobrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><TrendingUp className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                <p className="text-xs text-muted-foreground">Por Cobrar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{activeCustomers}</p>
                <p className="text-xs text-muted-foreground">Clientes Nuevos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10"><PawPrint className="h-5 w-5 text-info" /></div>
              <div>
                <p className="text-2xl font-bold">{occupancyRate}%</p>
                <p className="text-xs text-muted-foreground">Ocupación ({occupiedKennels}/{totalKennels})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20"><Activity className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{totalReservations}</p>
                <p className="text-xs text-muted-foreground">Reservas (período)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><BarChart3 className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Tasa completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="admin" className="space-y-4">
        <TabsList>
          <TabsTrigger value="admin" className="gap-1.5"><ShieldCheck className="h-4 w-4" />Administración</TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5"><BarChart3 className="h-4 w-4" />Financiero</TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5"><Activity className="h-4 w-4" />Operaciones</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Users className="h-4 w-4" />Clientes</TabsTrigger>
        </TabsList>

        {/* Admin Tab — vista general para la parte administrativa */}
        <TabsContent value="admin" className="space-y-4">
          {adminLoading || !adminSummary ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10"><PawPrint className="h-5 w-5 text-success" /></div>
                      <div>
                        <p className="text-2xl font-bold">{adminSummary.activeDogsCount}</p>
                        <p className="text-xs text-muted-foreground">Con reservas (90 días)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted"><PawPrint className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <p className="text-2xl font-bold">{adminSummary.inactiveDogsCount}</p>
                        <p className="text-xs text-muted-foreground">Sin reservas (90 días)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10"><Warehouse className="h-5 w-5 text-info" /></div>
                      <div>
                        <p className="text-2xl font-bold">{occupiedKennels}/{totalKennels}</p>
                        <p className="text-xs text-muted-foreground">Perreras Ocupadas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="text-2xl font-bold">{adminSummary.totalCustomers}</p>
                        <p className="text-xs text-muted-foreground">Clientes Totales</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/20"><UserCog className="h-5 w-5 text-accent-foreground" /></div>
                      <div>
                        <p className="text-2xl font-bold">{adminSummary.activeStaffCount}</p>
                        <p className="text-xs text-muted-foreground">Empleados Activos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-kpi">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10"><ClipboardList className="h-5 w-5 text-warning" /></div>
                      <div>
                        <p className="text-2xl font-bold">{adminSummary.pendingTasksCount}</p>
                        <p className="text-xs text-muted-foreground">Tareas Pendientes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Contabilidad */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Contabilidad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                      <span className="text-sm font-medium">Ingresos Cobrados</span>
                      <span className="text-lg font-bold text-success">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                      <span className="text-sm font-medium">Cuentas por Cobrar</span>
                      <span className="text-lg font-bold text-warning">{formatCurrency(totalPending)}</span>
                    </div>
                    <Link
                      to={`${basePath}/invoices`}
                      className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
                    >
                      Ver todas las facturas
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>

                {/* Capacidad */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Capacidad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-info/10">
                      <span className="text-sm font-medium">Ocupación actual</span>
                      <span className="text-lg font-bold text-info">{occupancyRate}% ({occupiedKennels}/{totalKennels})</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Perreras disponibles</span>
                      <span className="text-lg font-bold">{availableKennels}</span>
                    </div>
                    <Link
                      to={`${basePath}/facility`}
                      className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
                    >
                      Ver mapa de perreras
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Perros y perreras asignadas */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Perros y Perreras</CardTitle>
                    <Badge variant="secondary">{adminSummary.dogs.length}</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-80 overflow-y-auto divide-y">
                      {adminSummary.dogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">Sin perros registrados</p>
                      ) : (
                        adminSummary.dogs.map((d) => (
                          <Link
                            key={d.id}
                            to={`${basePath}/dogs/${d.id}`}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{d.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{d.customerName}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <Badge variant="outline" className="text-xs font-normal">
                                {d.kennelName ?? "Sin perrera"}
                              </Badge>
                              <Badge variant={d.isActive ? "default" : "secondary"} className="text-xs">
                                {d.isActive ? "Con reservas" : "Sin reservas"}
                              </Badge>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Personal */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Personal</CardTitle>
                    <Badge variant="secondary">{adminSummary.staff.length}</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-80 overflow-y-auto divide-y">
                      {adminSummary.staff.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">Sin empleados registrados</p>
                      ) : (
                        adminSummary.staff.map((s) => (
                          <Link
                            key={s.id}
                            to={`${basePath}/tasks?assignee=${s.id}`}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                          >
                            <p className="font-medium truncate">{s.first_name} {s.last_name}</p>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <Badge variant="outline" className="text-xs font-normal">{STAFF_ROLE_LABELS[s.role] ?? s.role}</Badge>
                              <Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">
                                {s.is_active ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ingresos por Período</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para el período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), "Ingresos"]} />
                      <Bar dataKey="ingresos" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estado de Facturas</CardTitle>
              </CardHeader>
              <CardContent>
                {statusBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin facturas</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{reportCards.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Report Cards Generados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{activePlans}</p>
                  <p className="text-sm text-muted-foreground mt-1">Planes vigentes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{units.filter((u: any) => u.status === "maintenance").length}</p>
                  <p className="text-sm text-muted-foreground mt-1">En Mantenimiento</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Reservas por Servicio</CardTitle>
              </CardHeader>
              <CardContent>
                {reservationsByService.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin reservas en el período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={reservationsByService} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {reservationsByService.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estado de los planes</CardTitle>
              </CardHeader>
              <CardContent>
                {planBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin planes</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={planBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {planBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 5 Clientes por Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topCustomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                    <XAxis type="number" fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={140} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Gasto Total"]} />
                    <Bar dataKey="total" fill="hsl(222, 47%, 20%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{newCustomers.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Clientes Nuevos (período)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{formatCurrency(activeCustomers > 0 ? totalRevenue / activeCustomers : 0)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Ingreso Promedio por Cliente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
