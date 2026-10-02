import { useMemo, useState } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle, Bug, CalendarClock, ChevronRight, ClipboardList, Download, HeartPulse, Pill, RefreshCw, Search,
  ShieldCheck, Stethoscope, Syringe, X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { useClinicDashboard } from "@/hooks/queries/useClinicDashboard";
import { useUrlState } from "@/hooks/useUrlState";
import { parseDateOnly } from "@/lib/age";
import {
  CLINIC_SEGMENT_LABELS, CONDITION_SEVERITY_LABELS, CONDITION_STATUS_LABELS, EVENT_LABELS, RECORD_TYPE_LABELS,
  matchesSegment, relativeDay, summarize,
  type ClinicAlert, type ClinicDog, type ClinicEvent, type ClinicSegment, type DueItem, type EventType,
} from "@/lib/clinicDashboard";
import { cn } from "@/lib/utils";
import { specialCareDetail } from "@/lib/specialCare";

/** Pestaña de la ficha clínica que conviene abrir. */
export type ClinicTab = "history" | "vaccines" | "deworming" | "conditions" | "temperament";

interface Props {
  onOpenDog: (dogId: string, tab?: ClinicTab) => void;
}

const SEGMENTS = Object.keys(CLINIC_SEGMENT_LABELS) as ClinicSegment[];
const SEVERITY_DOT: Record<ClinicAlert["severity"], string> = { 0: "bg-destructive", 1: "bg-warning", 2: "bg-info" };
const EVENT_ICON: Record<EventType, typeof Syringe> = { vaccine: Syringe, deworming: Bug, control: Stethoscope, treatment_end: Pill };
const EVENT_TAB: Record<EventType, ClinicTab> = { vaccine: "vaccines", deworming: "deworming", control: "history", treatment_end: "history" };
const ALERT_TAB: Partial<Record<ClinicAlert["kind"], ClinicTab>> = {
  vaccine_overdue: "vaccines", no_vaccines: "vaccines", deworming_overdue: "deworming",
  condition_severe: "conditions", condition_active: "conditions",
};

const fmt = (d: string, pattern = "d MMM yyyy") => format(parseDateOnly(d), pattern, { locale: es });
const initials = (name: string) => name.slice(0, 2).toUpperCase();

function exportCsv(dogs: ClinicDog[], events: ClinicEvent[]) {
  const rows = dogs.map((d) => ({
    Perro: d.name,
    Dueño: d.owner?.name ?? "",
    "Teléfono dueño": d.owner?.phone ?? "",
    "Última consulta": d.lastConsult?.date ?? "",
    "Motivo / diagnóstico": d.lastConsult ? d.lastConsult.diagnosis || d.lastConsult.reason || "" : "",
    "Próximo control": d.nextControl?.date ?? "",
    Vacunas: d.vaccines.map((v) => `${v.name} (${v.state === "overdue" ? "vencida" : "próx."} ${v.nextDate}${v.estimated ? ", estimada" : ""})`).join("; "),
    "Próxima desparasitación": d.deworming ? `${d.deworming.nextDate}${d.deworming.estimated ? " (estimada)" : ""}` : "",
    Medicación: d.medications.map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(" ")).join("; "),
    Condiciones: d.conditions.map((c) => `${c.name} (${CONDITION_STATUS_LABELS[c.status] ?? c.status})`).join("; "),
    Alergias: d.allergies.map((a) => a.allergen).join(", "),
    Alertas: d.alerts.map((a) => a.label).join("; "),
  }));
  const agenda = events.map((e) => ({ Fecha: e.date, Tipo: EVENT_LABELS[e.type], Perro: e.dogName, Detalle: e.label, Estimada: e.estimated ? "Sí" : "", Vencida: e.overdue ? "Sí" : "" }));
  const csv = Papa.unparse(rows) + "\n\nAgenda clínica\n" + Papa.unparse(agenda);
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-clinico-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Panel de clínica: novedades, agenda de próximas fechas, tratamientos y cobertura. */
export function ClinicDashboard({ onOpenDog }: Props) {
  const { data, isLoading, isError, isFetching, refetch } = useClinicDashboard();
  const [search, setSearch] = useState("");
  const [segmentRaw, setSegment] = useUrlState<string>("segmento", "all");
  const [horizonRaw, setHorizon] = useUrlState<string>("dias", "30");
  const segment = (SEGMENTS.includes(segmentRaw as ClinicSegment) ? segmentRaw : "all") as ClinicSegment;
  const horizon = [30, 60, 90].includes(Number(horizonRaw)) ? Number(horizonRaw) : 30;

  const allDogs = useMemo(() => data?.dogs ?? [], [data?.dogs]);
  const q = search.trim().toLowerCase();
  const searched = useMemo(
    () => (q ? allDogs.filter((d) => d.name.toLowerCase().includes(q) || d.owner?.name.toLowerCase().includes(q)) : allDogs),
    [allDogs, q],
  );
  const visible = useMemo(() => searched.filter((d) => matchesSegment(d, segment)), [searched, segment]);
  const visibleIds = useMemo(() => new Set(visible.map((d) => d.id)), [visible]);
  const events = useMemo(() => (data?.events ?? []).filter((e) => visibleIds.has(e.dogId)), [data?.events, visibleIds]);
  const summary = useMemo(() => summarize(allDogs, data?.events ?? [], horizon), [allDogs, data?.events, horizon]);

  if (isError) return <QueryErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[118px] w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-lg" />
          <Skeleton className="h-[320px] rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }
  if (allDogs.length === 0) {
    return <EmptyState icon={Stethoscope} title="Aún no hay perros activos" description="Cuando registres perros, aquí verás su seguimiento clínico." />;
  }

  return (
    <div className="space-y-6">
      <Kpis summary={summary} horizon={horizon} segment={segment} onSegment={setSegment} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar perro o dueño…" aria-label="Buscar perro o dueño" className="pl-9" />
        </div>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="sm:w-56" aria-label="Filtrar perros"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{CLINIC_SEGMENT_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(visible, events)}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>
      {segment !== "all" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{visible.length} de {allDogs.length} perros</span>
          <Badge variant="secondary" className="gap-1">
            {CLINIC_SEGMENT_LABELS[segment]}
            <button type="button" onClick={() => setSegment("all")} aria-label="Quitar filtro"><X className="h-3 w-3" /></button>
          </Badge>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <AttentionCard dogs={visible} onOpenDog={onOpenDog} />
        <AgendaCard events={events} horizon={horizon} onHorizon={(h) => setHorizon(String(h))} onOpenDog={onOpenDog} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TreatmentsCard dogs={visible} onOpenDog={onOpenDog} />
        <CoverageCard summary={summary} />
        <RecentCard consults={(data.recentConsults ?? []).filter((c) => visibleIds.has(c.dogId))} onOpenDog={onOpenDog} />
      </div>

      <RosterCard dogs={visible} onOpenDog={onOpenDog} />
    </div>
  );
}

// ── Indicadores ───────────────────────────────────────────────────────────────

function Kpis({ summary: s, horizon, segment, onSegment }: {
  summary: ReturnType<typeof summarize>; horizon: number; segment: ClinicSegment; onSegment: (s: ClinicSegment) => void;
}) {
  const pct = (n: number) => (s.total ? Math.round((n / s.total) * 100) : 0);
  const tiles: { segment: ClinicSegment | null; label: string; value: string; detail: string; ratio?: number; critical?: boolean }[] = [
    { segment: "attention", label: "Con novedad clínica", value: s.attention.toLocaleString("es"), detail: `Pendientes clínicos · de ${s.total} perros`, critical: s.attention > 0 },
    { segment: "treatment", label: "En tratamiento", value: s.treatment.toLocaleString("es"), detail: "Medicación vigente o condición activa" },
    { segment: "special", label: "Cuidados especiales", value: s.special.total.toLocaleString("es"), detail: specialCareDetail(s.special) },
    { segment: "vaccines", label: "Vacunas al día", value: `${pct(s.vaccinesUpToDate)}%`, detail: s.vaccinesOverdue ? `${s.vaccinesOverdue} con vacunas vencidas` : "Ninguna vencida", ratio: s.total ? s.vaccinesUpToDate / s.total : 0, critical: s.vaccinesOverdue > 0 },
    { segment: "deworming", label: "Desparasitación al día", value: `${pct(s.dewormedRecently)}%`, detail: s.dewormingOverdue ? `${s.dewormingOverdue} vencidas` : "Ninguna vencida", ratio: s.total ? s.dewormedRecently / s.total : 0 },
    { segment: "controls", label: `Agenda · ${horizon} días`, value: s.upcoming.toLocaleString("es"), detail: `${s.controlsPending} controles pendientes` },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => {
        const selected = t.segment !== null && segment === t.segment;
        return (
          <button
            key={t.label}
            type="button"
            aria-pressed={selected}
            onClick={() => t.segment && onSegment(selected ? "all" : t.segment)}
            className={cn(
              "relative flex flex-col items-start bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              i === 0 && "col-span-2 sm:col-span-1",
              selected && "bg-muted",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className={cn("mt-1 font-semibold tracking-tight text-foreground", i === 0 ? "text-4xl" : "text-2xl")}>{t.value}</p>
            {t.ratio !== undefined && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-primary/10" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${t.ratio * 100}%` }} />
              </div>
            )}
            <p className={cn("mt-1.5 text-xs", t.critical ? "font-medium text-destructive" : "text-muted-foreground")}>{t.detail}</p>
            {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

// ── Requieren atención ────────────────────────────────────────────────────────

function DogAvatar({ dog, size = "h-9 w-9" }: { dog: Pick<ClinicDog, "name" | "photoUrl">; size?: string }) {
  return (
    <Avatar className={size}>
      <AvatarImage src={dog.photoUrl ?? undefined} alt="" />
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(dog.name)}</AvatarFallback>
    </Avatar>
  );
}

function AttentionCard({ dogs, onOpenDog }: { dogs: ClinicDog[]; onOpenDog: Props["onOpenDog"] }) {
  const [showAll, setShowAll] = useState(false);
  const ranked = dogs
    .filter((d) => d.alerts.some((a) => a.severity <= 1))
    .sort((a, b) => a.alerts[0].severity - b.alerts[0].severity || b.alerts.length - a.alerts.length || a.name.localeCompare(b.name, "es"));
  const shown = showAll ? ranked : ranked.slice(0, 7);
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Requieren atención</CardTitle>
        <CardDescription>Pendientes clínicos: novedades de rondas, vencimientos, controles, condiciones y pérdida de peso</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        {ranked.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <ShieldCheck className="h-8 w-8 text-success" aria-hidden />
            <p className="text-sm font-medium">Todo en orden</p>
            <p className="text-xs text-muted-foreground">Ningún perro tiene pendientes clínicos.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((dog) => (
              <li key={dog.id}>
                <button
                  type="button"
                  onClick={() => onOpenDog(dog.id, ALERT_TAB[dog.alerts[0].kind])}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <DogAvatar dog={dog} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {dog.name}
                      {dog.inCenter && <span className="ml-1.5 text-xs font-normal text-success">· en el centro</span>}
                    </p>
                    <ul className="space-y-0.5">
                      {dog.alerts.filter((a) => a.severity <= 1).slice(0, 3).map((a) => (
                        <li key={a.kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[a.severity])} aria-hidden />
                          <span className="truncate">{a.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {ranked.length > 7 && (
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Ver menos" : `Ver los ${ranked.length} perros`}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Agenda clínica ────────────────────────────────────────────────────────────

function AgendaCard({ events, horizon, onHorizon, onOpenDog }: {
  events: ClinicEvent[]; horizon: number; onHorizon: (h: number) => void; onOpenDog: Props["onOpenDog"];
}) {
  const [types, setTypes] = useState<Set<EventType>>(new Set(["vaccine", "deworming", "control", "treatment_end"]));
  const today = format(new Date(), "yyyy-MM-dd");
  const limit = format(new Date(Date.now() + horizon * 86_400_000), "yyyy-MM-dd");
  const weekLimit = format(new Date(Date.now() + 7 * 86_400_000), "yyyy-MM-dd");
  const filtered = events.filter((e) => types.has(e.type));
  const groups: { title: string; tone?: "danger"; items: ClinicEvent[] }[] = [
    { title: "Vencidos", tone: "danger", items: filtered.filter((e) => e.date < today).reverse() },
    { title: "Esta semana", items: filtered.filter((e) => e.date >= today && e.date <= weekLimit) },
    { title: `Hasta ${horizon} días`, items: filtered.filter((e) => e.date > weekLimit && e.date <= limit) },
  ];
  const toggle = (t: EventType) => setTypes((prev) => {
    const next = new Set(prev);
    if (next.has(t)) { if (next.size > 1) next.delete(t); } else next.add(t);
    return next;
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" aria-hidden /> Agenda clínica</CardTitle>
            <CardDescription>Próximas vacunas, desparasitaciones, controles y fines de tratamiento</CardDescription>
          </div>
          <Select value={String(horizon)} onValueChange={(v) => onHorizon(Number(v))}>
            <SelectTrigger className="h-8 w-32" aria-label="Horizonte de la agenda"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[30, 60, 90].map((h) => <SelectItem key={h} value={String(h)}>{h} días</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Tipos de evento">
          {(Object.keys(EVENT_LABELS) as EventType[]).map((t) => {
            const Icon = EVENT_ICON[t];
            const on = types.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                <Icon className="h-3 w-3" aria-hidden /> {EVENT_LABELS[t]}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-4 overflow-y-auto">
        {groups.every((g) => g.items.length === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nada en la agenda para este periodo.</p>
        ) : groups.filter((g) => g.items.length).map((g) => (
          <section key={g.title}>
            <h3 className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", g.tone === "danger" ? "text-destructive" : "text-muted-foreground")}>
              {g.title} ({g.items.length})
            </h3>
            <ul className="divide-y">
              {g.items.map((e, i) => {
                const Icon = EVENT_ICON[e.type];
                return (
                  <li key={`${e.dogId}-${e.type}-${e.label}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onOpenDog(e.dogId, EVENT_TAB[e.type])}
                      className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", e.overdue ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                      <div className="w-24 shrink-0">
                        <p className="text-sm font-medium tabular-nums">{fmt(e.date, "d MMM")}</p>
                        <p className={cn("text-xs", e.overdue ? "text-destructive" : "text-muted-foreground")}>{relativeDay(e.date)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm"><span className="font-medium">{e.dogName}</span> · {EVENT_LABELS[e.type]}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.label}{e.estimated ? " · fecha estimada" : ""}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {events.some((e) => e.estimated) && (
          <p className="text-xs text-muted-foreground">
            “Fecha estimada”: el registro no traía próxima dosis; se calcula a 1 año para vacunas y 3 meses para desparasitaciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── En tratamiento ────────────────────────────────────────────────────────────

function TreatmentsCard({ dogs, onOpenDog }: { dogs: ClinicDog[]; onOpenDog: Props["onOpenDog"] }) {
  const treated = dogs.filter((d) => d.medications.length > 0 || d.conditions.length > 0)
    .sort((a, b) => b.medications.length - a.medications.length || a.name.localeCompare(b.name, "es"));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Pill className="h-4 w-4 text-primary" aria-hidden /> En tratamiento</CardTitle>
        <CardDescription>Medicación vigente y condiciones sin resolver</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[360px] overflow-y-auto px-2">
        {treated.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ningún perro en tratamiento.</p>
        ) : (
          <ul className="space-y-1">
            {treated.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpenDog(d.id, d.conditions.length ? "conditions" : "history")}
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-sm font-medium">{d.name}</p>
                  {d.medications.map((m) => (
                    <p key={m.name} className="text-xs text-muted-foreground">
                      💊 {[m.name, m.dose, m.frequency].filter(Boolean).join(" · ")}{m.until ? ` · hasta ${fmt(m.until, "d MMM")}` : ""}
                    </p>
                  ))}
                  {d.conditions.map((c) => (
                    <p key={c.name} className="text-xs text-muted-foreground">
                      {c.name} · {CONDITION_STATUS_LABELS[c.status] ?? c.status} · {CONDITION_SEVERITY_LABELS[c.severity] ?? c.severity}
                    </p>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cobertura ─────────────────────────────────────────────────────────────────

function CoverageCard({ summary: s }: { summary: ReturnType<typeof summarize> }) {
  const rows = [
    { label: "Vacunas al día", value: s.vaccinesUpToDate, icon: Syringe },
    { label: "Desparasitación al día", value: s.dewormedRecently, icon: Bug },
    { label: "En tratamiento", value: s.treatment, icon: Pill },
    { label: "Con novedad", value: s.attention, icon: HeartPulse },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Cobertura del centro</CardTitle>
        <CardDescription>Sobre {s.total} perros activos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const pct = s.total ? Math.round((r.value / s.total) * 100) : 0;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1.5"><r.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {r.label}</span>
                <span className="tabular-nums text-muted-foreground"><span className="font-medium text-foreground">{r.value}</span> · {pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-primary/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={r.label}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Actividad reciente ───────────────────────────────────────────────────────

function RecentCard({ consults, onOpenDog }: { consults: NonNullable<ReturnType<typeof useClinicDashboard>["data"]>["recentConsults"]; onOpenDog: Props["onOpenDog"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Últimas consultas</CardTitle>
        <CardDescription>Lo más reciente de la historia clínica</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[360px] overflow-y-auto px-2">
        {consults.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin consultas registradas.</p>
        ) : (
          <ul className="divide-y">
            {consults.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenDog(c.dogId, "history")}
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.dogName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(c.date, "d MMM")}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {RECORD_TYPE_LABELS[c.type] ?? c.type} · {c.diagnosis || c.reason || "Sin motivo"}{c.veterinarian ? ` · ${c.veterinarian}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Listado ───────────────────────────────────────────────────────────────────

function DueCell({ item, empty }: { item: DueItem | null | undefined; empty: string }) {
  if (!item) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <span className={cn("text-xs", item.state === "overdue" ? "font-medium text-destructive" : item.state === "due_soon" ? "text-warning" : "text-muted-foreground")}>
      {item.state === "overdue" ? "Vencida" : "Próx."} {fmt(item.nextDate, "d MMM yy")}{item.estimated ? "*" : ""}
    </span>
  );
}

function RosterCard({ dogs, onOpenDog }: { dogs: ClinicDog[]; onOpenDog: Props["onOpenDog"] }) {
  const sorted = [...dogs].sort((a, b) => (a.alerts[0]?.severity ?? 3) - (b.alerts[0]?.severity ?? 3) || a.name.localeCompare(b.name, "es"));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Estado clínico por perro</CardTitle>
        <CardDescription>{dogs.length} perros · * fecha estimada</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perro</TableHead>
              <TableHead>Última consulta</TableHead>
              <TableHead>Vacunas</TableHead>
              <TableHead>Desparasitación</TableHead>
              <TableHead>Tratamiento</TableHead>
              <TableHead>Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((d) => {
              const worstVaccine = d.vaccines.find((v) => v.state === "overdue") ?? d.vaccines[0];
              return (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => onOpenDog(d.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DogAvatar dog={d} size="h-8 w-8" />
                      <div className="min-w-0">
                        <button type="button" className="truncate text-sm font-medium hover:underline" onClick={(e) => { e.stopPropagation(); onOpenDog(d.id); }}>{d.name}</button>
                        <p className="truncate text-xs text-muted-foreground">{d.owner?.name ?? "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[10rem] text-xs">
                    {d.lastConsult ? (
                      <>
                        <span className="tabular-nums">{fmt(d.lastConsult.date, "d MMM yy")}</span>
                        <p className="max-w-[14rem] truncate text-muted-foreground">{d.lastConsult.diagnosis || d.lastConsult.reason}</p>
                      </>
                    ) : <span className="text-muted-foreground">Sin consultas</span>}
                  </TableCell>
                  <TableCell className="min-w-[8rem]">
                    <DueCell item={worstVaccine} empty="Sin registro" />
                    {d.vaccines.length > 1 && <p className="text-xs text-muted-foreground">{d.vaccines.length} vacunas</p>}
                  </TableCell>
                  <TableCell className="min-w-[8rem]"><DueCell item={d.deworming} empty="Sin registro" /></TableCell>
                  <TableCell className="min-w-[8rem] text-xs">
                    {d.medications.length ? d.medications.map((m) => m.name).join(", ") : d.conditions.length ? d.conditions.map((c) => c.name).join(", ") : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    {d.alerts.filter((a) => a.severity <= 1).length === 0 ? (
                      <span className="text-xs text-success">Al día</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {d.alerts.filter((a) => a.severity <= 1).slice(0, 2).map((a) => (
                          <li key={a.kind} className="flex items-center gap-1.5 text-xs">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[a.severity])} aria-hidden />
                            <span className="max-w-[16rem] truncate">{a.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
