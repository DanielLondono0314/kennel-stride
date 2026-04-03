import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, DollarSign, Users, PawPrint, BarChart3, PieChart as PieChartIcon, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";

type DateRange = "30d" | "90d" | "6m" | "1y";

const COLORS = [
  "hsl(38, 92%, 50%)", "hsl(222, 47%, 20%)", "hsl(142, 76%, 36%)",
  "hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)", "hsl(0, 84%, 60%)",
];

export default function ReportsPage() {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  const dateFrom = useMemo(() => {
    const now = new Date();
    switch (range) {
      case "30d": return subDays(now, 30);
      case "90d": return subDays(now, 90);
      case "6m": return subMonths(now, 6);
      case "1y": return subMonths(now, 12);
    }
  }, [range]);

  useEffect(() => {
    const fetch = async () => {
      if (!organization) return;
      setLoading(true);
      const [invR, custR, pkgR, unitR, rcR, resR] = await Promise.all([
        supabase.from("invoices").select("*").eq("organization_id", organization!.id),
        supabase.from("customers").select("*").eq("organization_id", organization!.id),
        supabase.from("packages").select("*").eq("organization_id", organization!.id),
        supabase.from("facility_units").select("*").eq("organization_id", organization!.id),
        supabase.from("report_cards").select("*").eq("organization_id", organization!.id),
        supabase.from("reservations").select("id, service_type, status, start_date, total_price, customer_id").eq("organization_id", organization!.id),
      ]);
      setInvoices(invR.data || []);
      setCustomers(custR.data || []);
      setPackages(pkgR.data || []);
      setUnits(unitR.data || []);
      setReportCards(rcR.data || []);
      setReservations(resR.data || []);
      setLoading(false);
    };
    fetch();
  }, [organization?.id]);

  const filteredInvoices = useMemo(
    () => invoices.filter((i) => new Date(i.created_at) >= dateFrom),
    [invoices, dateFrom]
  );

  const filteredReservations = useMemo(
    () => reservations.filter((r) => new Date(r.start_date) >= dateFrom),
    [reservations, dateFrom]
  );

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
      completed: "Completadas", cancelled: "Canceladas",
    };
    const counts: Record<string, number> = {};
    filteredReservations.forEach((r) => {
      const label = statusLabels[r.status] ?? r.status;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReservations]);

  // KPIs
  const totalRevenue = filteredInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const totalPending = filteredInvoices.filter((i) => i.status === "pending" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
  const activeCustomers = customers.length;
  const occupiedKennels = units.filter((u) => u.status === "occupied").length;
  const totalKennels = units.length;
  const occupancyRate = totalKennels > 0 ? Math.round((occupiedKennels / totalKennels) * 100) : 0;
  const totalReservations = filteredReservations.length;
  const completedReservations = filteredReservations.filter((r) => r.status === "completed").length;
  const conversionRate = totalReservations > 0 ? Math.round((completedReservations / totalReservations) * 100) : 0;

  // Revenue by month chart
  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    filteredInvoices
      .filter((i) => i.status === "paid")
      .forEach((inv) => {
        const key = format(new Date(inv.created_at), "MMM yy", { locale: es });
        months[key] = (months[key] || 0) + Number(inv.total);
      });
    return Object.entries(months).map(([name, ingresos]) => ({ name, ingresos }));
  }, [filteredInvoices]);

  // Invoice status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInvoices.forEach((i) => {
      const label = i.status === "paid" ? "Pagadas" : i.status === "pending" ? "Pendientes" : i.status === "overdue" ? "Vencidas" : "Canceladas";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  // Package status
  const pkgBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    packages.forEach((p) => {
      const label = p.status === "active" ? "Activos" : p.status === "depleted" ? "Agotados" : p.status === "expired" ? "Expirados" : "Cancelados";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [packages]);

  // Top customers
  const topCustomers = useMemo(() => {
    const spending: Record<string, { name: string; total: number }> = {};
    filteredInvoices
      .filter((i) => i.status === "paid")
      .forEach((inv) => {
        const cust = customers.find((c) => c.id === inv.customer_id);
        if (!cust) return;
        const key = cust.id;
        if (!spending[key]) spending[key] = { name: `${cust.first_name} ${cust.last_name}`, total: 0 };
        spending[key].total += Number(inv.total);
      });
    return Object.values(spending).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredInvoices, customers]);

  if (loading) {
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
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">${totalPending.toLocaleString()}</p>
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
                <p className="text-xs text-muted-foreground">Clientes Registrados</p>
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
              <div className="p-2 rounded-lg bg-green-100"><BarChart3 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Tasa completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial" className="gap-1.5"><BarChart3 className="h-4 w-4" />Financiero</TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5"><Activity className="h-4 w-4" />Operaciones</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Users className="h-4 w-4" />Clientes</TabsTrigger>
        </TabsList>

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
                      <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Ingresos"]} />
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
                  <p className="text-3xl font-bold">{packages.filter((p) => p.status === "active").length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Paquetes Activos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{units.filter((u) => u.status === "maintenance").length}</p>
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
                <CardTitle className="text-base">Estado de Paquetes</CardTitle>
              </CardHeader>
              <CardContent>
                {pkgBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin paquetes</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pkgBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pkgBreakdown.map((_, i) => (
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
                    <XAxis type="number" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={140} />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Gasto Total"]} />
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
                  <p className="text-3xl font-bold">{customers.filter((c) => new Date(c.created_at) >= dateFrom).length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Clientes Nuevos (período)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-kpi">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">${activeCustomers > 0 ? Math.round(totalRevenue / activeCustomers).toLocaleString() : 0}</p>
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
