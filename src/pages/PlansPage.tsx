import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardList, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { AssignPlanDialog } from "@/components/plans/AssignPlanDialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrgPlans } from "@/hooks/queries/useDogPlans";
import { usePermission } from "@/hooks/usePermission";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { PLAN_STATE_LABELS, planProgressText, planState, type PlanState } from "@/lib/dogPlans";

type Filter = "current" | "attention" | "closed" | "all";

const FILTER_LABELS: Record<Filter, string> = {
  current: "Vigentes",
  attention: "Requieren atención",
  closed: "Finalizados",
  all: "Todos",
};

const STATE_STYLE: Record<PlanState, string> = {
  upcoming: "bg-info/10 text-info",
  active: "bg-success/10 text-success",
  expiring: "bg-warning/15 text-warning",
  expired: "bg-destructive/10 text-destructive",
  depleted: "bg-destructive/10 text-destructive",
  finished: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

/** Por vencer, vencidos o agotados sin renovar ni finalizar. */
const ATTENTION: ReadonlySet<PlanState> = new Set(["expiring", "expired", "depleted"]);

/** Planes de todos los perros del centro (reemplaza los paquetes de créditos). */
export default function PlansPage() {
  const base = useOrgBasePath();
  const { organization } = useOrganization();
  const { data: plans = [], isLoading, isError, refetch } = useOrgPlans();
  const canSchedule = usePermission("schedule");
  const canBill = usePermission("billing");
  const [filter, setFilter] = useState<Filter>("current");
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  // Perros para "Asignar plan".
  const { data: dogs = [] } = useQuery({
    queryKey: ["plans-page-dogs", organization?.id],
    enabled: !!organization?.id && (canSchedule || canBill),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dogs")
        .select("id, name, customers(first_name, last_name)")
        .eq("organization_id", organization!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((d) => {
        const c = d.customers as { first_name: string; last_name: string } | null;
        return { id: d.id, name: c ? `${d.name} · ${c.first_name} ${c.last_name}`.trim() : d.name };
      });
    },
  });

  const rows = useMemo(() => plans.map((p) => ({ plan: p, state: planState(p) })), [plans]);

  const kpis = useMemo(() => {
    const month = format(new Date(), "yyyy-MM");
    return {
      current: rows.filter((r) => r.plan.status === "active" && !["expired", "depleted"].includes(r.state)).length,
      expiring: rows.filter((r) => r.state === "expiring").length,
      lapsed: rows.filter((r) => r.state === "expired" || r.state === "depleted").length,
      soldThisMonth: rows
        .filter((r) => r.plan.status !== "cancelled" && r.plan.sold_on?.startsWith(month))
        .reduce((s, r) => s + Number(r.plan.price), 0),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(({ plan, state }) => {
        if (filter === "current") return plan.status === "active" && !["expired", "depleted"].includes(state);
        if (filter === "attention") return plan.status === "active" && ATTENTION.has(state);
        if (filter === "closed") return plan.status !== "active";
        return true;
      })
      .filter(({ plan }) => {
        if (!q) return true;
        const owner = plan.customers ? `${plan.customers.first_name} ${plan.customers.last_name}` : "";
        return [plan.dogs?.name, owner, plan.service_label].some((s) => s?.toLowerCase().includes(q));
      });
  }, [rows, filter, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planes</h1>
          <p className="text-muted-foreground">Los planes contratados por cada perro: vigencia, uso y renovaciones</p>
        </div>
        {(canSchedule || canBill) && (
          <Button onClick={() => setAssignOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Asignar plan
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Kpi icon={CheckCircle2} tone="success" value={kpis.current} label="Vigentes" />
        <Kpi icon={CalendarCheck} tone="warning" value={kpis.expiring} label="Por vencer" />
        <Kpi icon={AlertTriangle} tone="destructive" value={kpis.lapsed} label="Vencidos o agotados" />
        <Kpi icon={Wallet} tone="primary" value={formatCurrency(kpis.soldThisMonth)} label="Vendido este mes" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar perro, dueño o plan…"
            aria-label="Buscar planes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="sm:w-52" aria-label="Filtrar planes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <SelectItem key={f} value={f}>{FILTER_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isError ? (
            <QueryErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="p-4"><TableSkeleton rows={5} columns={5} /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ClipboardList className="mb-4 h-12 w-12 opacity-50" aria-hidden />
              <p className="font-medium">{plans.length === 0 ? "Aún no hay planes" : "Ningún plan coincide"}</p>
              <p className="text-sm">
                {plans.length === 0
                  ? "Asigna un plan desde aquí o desde el perfil del perro."
                  : "Prueba con otro filtro o búsqueda."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perro</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ plan, state }) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <Link
                        to={`${base}/dogs/${plan.dog_id}?tab=plan`}
                        className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                      >
                        {plan.dogs?.name ?? "Perro"}
                      </Link>
                      {plan.customers && (
                        <p className="text-xs text-muted-foreground">
                          {plan.customers.first_name} {plan.customers.last_name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[10rem]">{plan.service_label}</TableCell>
                    <TableCell className="min-w-[12rem] text-sm text-muted-foreground">{planProgressText(plan)}</TableCell>
                    <TableCell>
                      <Badge className={cn("border-0", STATE_STYLE[state])}>{PLAN_STATE_LABELS[state]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {Number(plan.price) > 0 ? formatCurrency(plan.price) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AssignPlanDialog open={assignOpen} onOpenChange={setAssignOpen} dogs={dogs} />
    </div>
  );
}

const TONES = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
} as const;

function Kpi({ icon: Icon, tone, value, label }: { icon: typeof CheckCircle2; tone: keyof typeof TONES; value: number | string; label: string }) {
  return (
    <Card className="card-kpi">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", TONES[tone])}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
