import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData, DashboardDog, PlanState } from "@/hooks/queries/useDogDashboard";
import { parseDateOnly } from "@/lib/age";
import { WEIGHT_STATUS_LABELS, type WeightStatus } from "@/lib/weightTrend";
import { WEIGHT_STATUS_STYLES } from "@/components/weight/weightStatusStyles";
import { SegmentedMeter, type MeterSegment } from "./SegmentedMeter";
import { FOOD_TYPE_LABELS, PLAN_STATE_LABELS } from "./model";
import { CalendarClock, CheckCircle2, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionCard({ title, description, children, className }: {
  title: string; description?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

// ── Salud del peso ───────────────────────────────────────────────────────────

const WEIGHT_ORDER: WeightStatus[] = ["loss", "gain", "stable", "single", "no_data"];

export function WeightHealthCard({ dogs, alertPct, windowDays, active, onSelect }: {
  dogs: DashboardDog[]; alertPct: number; windowDays: number;
  active: WeightStatus | ""; onSelect: (s: WeightStatus | "") => void;
}) {
  const segments: MeterSegment<WeightStatus>[] = WEIGHT_ORDER.map((s) => ({
    key: s,
    label: WEIGHT_STATUS_LABELS[s],
    count: dogs.filter((d) => d.weight.status === s).length,
    colorClass: WEIGHT_STATUS_STYLES[s].dot,
    icon: WEIGHT_STATUS_STYLES[s].icon,
  }));

  return (
    <SectionCard
      title="Salud del peso"
      description={`Variación en los últimos ${windowDays} días · alerta a partir de ±${alertPct}%`}
    >
      <SegmentedMeter segments={segments} total={dogs.length} active={active} onSelect={onSelect} ariaLabel="Distribución de estado de peso" />
    </SectionCard>
  );
}

// ── Actividad de pesaje ──────────────────────────────────────────────────────

interface WeekRow { label: string; range: string; count: number; dogs: number; isCurrent: boolean }

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{r.range}</p>
      <p className="mt-1 text-foreground"><span className="font-semibold">{r.count}</span> pesada{r.count === 1 ? "" : "s"}</p>
      <p className="text-muted-foreground">{r.dogs} perro{r.dogs === 1 ? "" : "s"} distinto{r.dogs === 1 ? "" : "s"}</p>
    </div>
  );
}

export function WeighInActivityCard({ weeks, totalDogs }: { weeks: DashboardData["weighInsByWeek"]; totalDogs: number }) {
  const rows = useMemo<WeekRow[]>(() => weeks.map((w, i) => {
    const start = parseDateOnly(w.weekStart);
    return {
      label: format(start, "d MMM", { locale: es }),
      range: `Semana del ${format(start, "d MMM", { locale: es })} al ${format(addDays(start, 6), "d MMM", { locale: es })}`,
      count: w.count,
      dogs: w.dogs,
      isCurrent: i === weeks.length - 1,
    };
  }), [weeks]);

  const last4 = weeks.slice(-4).reduce((s, w) => s + w.count, 0);
  const avg = weeks.length ? Math.round(weeks.reduce((s, w) => s + w.count, 0) / weeks.length) : 0;

  return (
    <SectionCard
      title="Actividad de pesaje"
      description={`${last4} pesadas en las últimas 4 semanas · promedio ${avg}/semana para ${totalDogs} perros`}
      className="lg:col-span-2"
    >
      <div className="h-[196px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<WeekTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.label} fill={r.isCurrent ? "hsl(var(--accent))" : "hsl(var(--primary))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden /> Semana en curso
      </p>
    </SectionCard>
  );
}

// ── Cobertura de planes ──────────────────────────────────────────────────────

const PLAN_ORDER: PlanState[] = ["active", "expiring", "none"];
const PLAN_STYLE: Record<PlanState, { colorClass: string; icon: typeof CheckCircle2 }> = {
  active: { colorClass: "bg-success", icon: CheckCircle2 },
  expiring: { colorClass: "bg-warning", icon: CalendarClock },
  none: { colorClass: "bg-muted-foreground/30", icon: CircleSlash },
};

export function PlanCoverageCard({ dogs, active, onSelect }: {
  dogs: DashboardDog[]; active: PlanState | ""; onSelect: (s: PlanState | "") => void;
}) {
  const segments: MeterSegment<PlanState>[] = PLAN_ORDER.map((s) => ({
    key: s,
    label: PLAN_STATE_LABELS[s],
    count: dogs.filter((d) => d.plan.state === s).length,
    colorClass: PLAN_STYLE[s].colorClass,
    icon: PLAN_STYLE[s].icon,
  }));

  const topPlans = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dogs) if (d.plan.name) m.set(d.plan.name, (m.get(d.plan.name) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [dogs]);

  return (
    <SectionCard title="Planes activos" description="Bono vigente del dueño · por vencer = ≤7 días o ≤2 créditos">
      <SegmentedMeter segments={segments} total={dogs.length} active={active} onSelect={onSelect} ariaLabel="Cobertura de planes" />
      {topPlans.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Planes más usados</p>
          <ul className="space-y-1 text-sm">
            {topPlans.map(([name, n]) => (
              <li key={name} className="flex justify-between gap-2">
                <span className="truncate text-foreground">{name}</span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

// ── Alimentación ─────────────────────────────────────────────────────────────

export function FeedingMixCard({ dogs, active, onSelect }: {
  dogs: DashboardDog[]; active: string; onSelect: (s: string) => void;
}) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of dogs) {
      const k = d.feeding?.foodType ?? "sin_dato";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: FOOD_TYPE_LABELS[key] ?? (key === "sin_dato" ? "Sin registrar" : key), count }))
      // "Sin registrar" siempre al final; el resto de mayor a menor.
      .sort((a, b) => (a.key === "sin_dato" ? 1 : b.key === "sin_dato" ? -1 : b.count - a.count));
  }, [dogs]);
  const max = Math.max(1, ...rows.map((r) => r.count));

  const meals = dogs.map((d) => d.feeding?.mealsPerDay).filter((n): n is number => typeof n === "number" && n > 0);
  const avgMeals = meals.length ? (meals.reduce((s, n) => s + n, 0) / meals.length).toLocaleString("es", { maximumFractionDigits: 1 }) : "—";
  const withInstructions = dogs.filter((d) => d.feeding?.instructions).length;

  return (
    <SectionCard title="Alimentación" description={`${avgMeals} comidas/día en promedio · ${withInstructions} con indicaciones especiales`}>
      <ul className="space-y-1">
        {rows.map((r) => {
          const isActive = active === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onSelect(isActive ? "" : r.key)}
                aria-pressed={isActive}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive && "bg-muted",
                  active && !isActive && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{r.label}</span>
                  <span className="tabular-nums font-medium text-foreground">{r.count}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-primary/10" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", r.key === "sin_dato" ? "bg-muted-foreground/40" : "bg-primary")}
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
