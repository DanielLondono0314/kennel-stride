import { useMemo, useState } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDogDashboard, useDogDashboardConfig, type DashboardDog, type PlanState } from "@/hooks/queries/useDogDashboard";
import { usePermission } from "@/hooks/usePermission";
import { useUrlState } from "@/hooks/useUrlState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { DashboardKpis } from "@/components/dog-dashboard/DashboardKpis";
import { WeightHealthCard, WeighInActivityCard, PlanCoverageCard, FeedingMixCard } from "@/components/dog-dashboard/InsightCards";
import { AttentionList } from "@/components/dog-dashboard/AttentionList";
import { DogRosterCard, DogRosterTable } from "@/components/dog-dashboard/DogRoster";
import { DogDetailSheet } from "@/components/dog-dashboard/DogDetailSheet";
import { CustomizeDashboardSheet } from "@/components/dog-dashboard/CustomizeDashboardSheet";
import {
  applyFilters, FOOD_TYPE_LABELS, PLAN_STATE_LABELS, SEGMENT_LABELS, SORT_LABELS,
  type DashboardFilters, type Segment, type SortKey,
} from "@/components/dog-dashboard/model";
import { DEFAULT_DOG_DASHBOARD_CONFIG } from "@/lib/dogDashboardConfig";
import { WEIGHT_STATUS_LABELS, type WeightStatus } from "@/lib/weightTrend";
import { Search, SlidersHorizontal, LayoutGrid, List, Download, X, Dog, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const SEGMENTS: Segment[] = ["all", "in_center", "attention", "overdue", "no_plan"];

function exportCsv(dogs: DashboardDog[]) {
  const rows = dogs.map((d) => ({
    Perro: d.name,
    Raza: d.breed,
    Edad: d.age,
    Dueño: d.owner?.name ?? "",
    "Teléfono dueño": d.owner?.phone ?? "",
    "Peso actual (kg)": d.weight.latest?.weight ?? "",
    "Fecha último pesaje": d.weight.latest?.date ?? "",
    "Días sin pesar": d.weight.daysSinceLast ?? "",
    "Peso referencia (kg)": d.weight.baseline?.weight ?? "",
    "Fecha referencia": d.weight.baseline?.date ?? "",
    "Variación (kg)": d.weight.changeKg ?? "",
    "Variación (%)": d.weight.changePct ?? "",
    "Estado de peso": WEIGHT_STATUS_LABELS[d.weight.status],
    "Pesaje vencido": d.weight.isOverdue ? "Sí" : "No",
    "Plan activo": d.plan.name ?? PLAN_STATE_LABELS.none,
    "Créditos restantes": d.plan.state === "none" ? "" : `${d.plan.remaining}/${d.plan.total}`,
    "Plan vence": d.plan.expiresAt?.slice(0, 10) ?? "",
    Alimentación: d.feeding?.foodType ? FOOD_TYPE_LABELS[d.feeding.foodType] ?? d.feeding.foodType : "",
    Marca: d.feeding?.brand ?? "",
    "Comidas/día": d.feeding?.mealsPerDay ?? "",
    Porción: d.feeding?.portion ?? "",
    Estancia: d.stay.state === "in_center" ? "En el centro" : d.stay.state === "upcoming" ? `Próxima ${d.stay.startDate?.slice(0, 10)}` : "",
    Perrera: d.kennel ?? "",
    Alergias: d.allergies.map((a) => a.allergen).join(", "),
    Medicación: d.medications.map((m) => m.name).join(", "),
    "Vacunas vencidas": d.vaccines.overdue.join(", "),
  }));
  // BOM para que Excel abra bien los acentos.
  const blob = new Blob(["﻿" + Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-perros-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[118px] w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg lg:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[220px] rounded-lg" />)}
      </div>
    </div>
  );
}

export default function DogDashboardPage() {
  const canEditConfig = usePermission("manage_settings");
  const configQuery = useDogDashboardConfig();
  const config = configQuery.data ?? DEFAULT_DOG_DASHBOARD_CONFIG;
  const { data, isLoading, isError, refetch, isFetching } = useDogDashboard(config.weight);

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useUrlState<string>("segmento", "all");
  const [weightStatus, setWeightStatus] = useUrlState<string>("peso", "");
  const [planState, setPlanState] = useUrlState<string>("plan", "");
  const [foodType, setFoodType] = useUrlState<string>("comida", "");
  const [sort, setSort] = useUrlState<string>("orden", "name");
  const [view, setView] = useUrlState<string>("vista", "grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const dogs = useMemo(() => data?.dogs ?? [], [data?.dogs]);
  const filters = useMemo<DashboardFilters>(() => ({
    search,
    segment: (SEGMENTS.includes(segment as Segment) ? segment : "all") as Segment,
    weightStatus: weightStatus as WeightStatus | "",
    planState: planState as PlanState | "",
    foodType,
    sort: (sort in SORT_LABELS ? sort : "name") as SortKey,
  }), [search, segment, weightStatus, planState, foodType, sort]);
  const visible = useMemo(() => applyFilters(dogs, filters), [dogs, filters]);
  // Se busca por id en los datos frescos: si se registra un peso desde la ficha, se actualiza sola.
  const selected = selectedId ? dogs.find((d) => d.id === selectedId) ?? null : null;

  const chips = [
    weightStatus && { label: WEIGHT_STATUS_LABELS[weightStatus as WeightStatus], clear: () => setWeightStatus("") },
    planState && { label: PLAN_STATE_LABELS[planState as PlanState], clear: () => setPlanState("") },
    foodType && { label: `Alimentación: ${FOOD_TYPE_LABELS[foodType] ?? "Sin registrar"}`, clear: () => setFoodType("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];
  const hasFilters = chips.length > 0 || filters.segment !== "all" || search.trim() !== "";
  const clearAll = () => { setSearch(""); setSegment("all"); setWeightStatus(""); setPlanState(""); setFoodType(""); };

  const s = config.sections;
  const scrollToRoster = () => document.getElementById("dog-roster")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de perros</h1>
          <p className="text-muted-foreground">
            Todos los perros activos del centro
            {data && ` · actualizado ${format(new Date(data.generatedAt), "HH:mm", { locale: es })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar datos">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv(visible)} disabled={!visible.length}>
            <Download className="mr-1.5 h-4 w-4" />Exportar reporte
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />Personalizar
          </Button>
        </div>
      </div>

      {isError ? (
        <QueryErrorState title="No se pudo cargar el panel" onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : dogs.length === 0 ? (
        <EmptyState icon={Dog} title="Aún no hay perros activos" description="Cuando registres perros activos aparecerán aquí con su peso, plan y alimentación." />
      ) : (
        <div className={cn("space-y-6 transition-opacity", isFetching && "opacity-70")}>
          {s.kpis && (
            <DashboardKpis dogs={dogs} segment={filters.segment} onSegment={(v) => { setSegment(v); scrollToRoster(); }} />
          )}

          {(s.weightHealth || s.weighInActivity) && (
            <div className="grid gap-4 lg:grid-cols-3">
              {s.weightHealth && (
                <WeightHealthCard
                  dogs={dogs}
                  alertPct={config.weight.alertPct}
                  windowDays={config.weight.windowDays}
                  active={filters.weightStatus}
                  onSelect={(v) => { setWeightStatus(v); if (v) scrollToRoster(); }}
                />
              )}
              {s.weighInActivity && <WeighInActivityCard weeks={data.weighInsByWeek} totalDogs={dogs.length} />}
            </div>
          )}

          {(s.attention || s.planCoverage || s.feedingMix) && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {s.attention && (
                <AttentionList
                  dogs={dogs}
                  onOpen={(d) => setSelectedId(d.id)}
                  onShowAll={() => { setSegment("attention"); scrollToRoster(); }}
                />
              )}
              {s.planCoverage && (
                <PlanCoverageCard dogs={dogs} active={filters.planState} onSelect={(v) => { setPlanState(v); if (v) scrollToRoster(); }} />
              )}
              {s.feedingMix && (
                <FeedingMixCard dogs={dogs} active={foodType} onSelect={(v) => { setFoodType(v); if (v) scrollToRoster(); }} />
              )}
            </div>
          )}

          {s.roster && (
            <section id="dog-roster" className="scroll-mt-4 space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center">
                <div className="relative lg:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar perro, raza, dueño…"
                    className="pl-9"
                    aria-label="Buscar perros"
                  />
                </div>
                <ToggleGroup
                  type="single"
                  value={filters.segment}
                  onValueChange={(v) => v && setSegment(v)}
                  className="flex flex-wrap justify-start gap-1"
                  aria-label="Segmento"
                >
                  {SEGMENTS.map((seg) => (
                    <ToggleGroupItem
                      key={seg}
                      value={seg}
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {SEGMENT_LABELS[seg]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="flex items-center gap-2 lg:ml-auto">
                  <Select value={filters.sort} onValueChange={setSort}>
                    <SelectTrigger className="h-9 w-[210px]" aria-label="Ordenar por"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} aria-label="Vista">
                    <ToggleGroupItem value="grid" size="sm" aria-label="Vista de tarjetas" className="data-[state=on]:bg-muted data-[state=on]:text-foreground"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
                    <ToggleGroupItem value="table" size="sm" aria-label="Vista de tabla" className="data-[state=on]:bg-muted data-[state=on]:text-foreground"><List className="h-4 w-4" /></ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground" aria-live="polite">
                  {visible.length === dogs.length ? `${dogs.length} perros` : `${visible.length} de ${dogs.length} perros`}
                </span>
                {chips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={c.clear}
                    className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs text-foreground hover:bg-muted"
                    aria-label={`Quitar filtro ${c.label}`}
                  >
                    {c.label}<X className="h-3 w-3" aria-hidden />
                  </button>
                ))}
                {hasFilters && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={clearAll}>Limpiar filtros</Button>
                )}
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Ningún perro coincide"
                  description="Prueba con otro filtro o búsqueda."
                  action={<Button variant="outline" size="sm" onClick={clearAll}>Limpiar filtros</Button>}
                />
              ) : view === "table" ? (
                <DogRosterTable dogs={visible} fields={config.cardFields} onOpen={(d) => setSelectedId(d.id)} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visible.map((d) => (
                    <DogRosterCard key={d.id} dog={d} fields={config.cardFields} onOpen={() => setSelectedId(d.id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <DogDetailSheet
        dog={selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        settings={config.weight}
        fields={config.cardFields}
      />
      <CustomizeDashboardSheet open={customizeOpen} onOpenChange={setCustomizeOpen} config={config} canEdit={canEditConfig} />
    </div>
  );
}
