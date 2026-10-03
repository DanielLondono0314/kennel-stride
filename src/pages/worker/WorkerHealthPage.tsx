import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bug, ChevronRight, HeartPulse, Pill, Stethoscope, Syringe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { useClinicDashboard } from "@/hooks/queries/useClinicDashboard";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { useUrlState } from "@/hooks/useUrlState";
import { parseDateOnly } from "@/lib/age";
import { CONDITION_SEVERITY_LABELS, CONDITION_STATUS_LABELS, relativeDay, type ClinicEvent, type EventType } from "@/lib/clinicDashboard";
import { cn } from "@/lib/utils";

type View = "vaccine" | "deworming" | "control" | "treatment";

const VIEWS: { key: View; label: string; icon: typeof Syringe }[] = [
  { key: "vaccine", label: "Vacunas", icon: Syringe },
  { key: "deworming", label: "Desparasitación", icon: Bug },
  { key: "control", label: "Controles", icon: Stethoscope },
  { key: "treatment", label: "Tratamientos", icon: Pill },
];

/** Pestaña de salud de la ficha del perro que corresponde a cada evento. */
const DOG_TAB: Record<EventType, string> = {
  vaccine: "vacunas",
  deworming: "desparasitacion",
  control: "historial",
  treatment_end: "historial",
};

const HORIZON_DAYS = 30;

/**
 * Salud (app del trabajador): qué vacunas, desparasitaciones y controles
 * están vencidos o vienen pronto, y quién está en tratamiento. Mismos datos y
 * reglas que el panel de Clínica.
 */
export default function WorkerHealthPage() {
  const base = useOrgBasePath();
  const { data, isLoading, isError, refetch } = useClinicDashboard();
  const [viewRaw, setView] = useUrlState<string>("ver", "vaccine", { replace: true });
  const view = (VIEWS.some((v) => v.key === viewRaw) ? viewRaw : "vaccine") as View;

  const today = format(new Date(), "yyyy-MM-dd");
  const limit = format(new Date(Date.now() + HORIZON_DAYS * 86_400_000), "yyyy-MM-dd");
  const weekLimit = format(new Date(Date.now() + 7 * 86_400_000), "yyyy-MM-dd");

  const counts = useMemo(() => {
    const events = data?.events ?? [];
    const of = (t: EventType) => events.filter((e) => e.type === t && e.date <= limit);
    return {
      vaccine: of("vaccine").length,
      deworming: of("deworming").length,
      control: of("control").length,
      treatment: (data?.dogs ?? []).filter((d) => d.medications.length || d.conditions.length).length,
      overdueVaccine: of("vaccine").filter((e) => e.overdue).length,
      overdueDeworming: of("deworming").filter((e) => e.overdue).length,
      overdueControl: of("control").filter((e) => e.overdue).length,
    };
  }, [data, limit]);

  if (isError) return <QueryErrorState onRetry={() => refetch()} />;

  const events = (data?.events ?? []).filter((e) => e.type === view && e.date <= limit);
  const groups: { title: string; danger?: boolean; items: ClinicEvent[] }[] = [
    { title: "Vencidas", danger: true, items: events.filter((e) => e.date < today).reverse() },
    { title: "Esta semana", items: events.filter((e) => e.date >= today && e.date <= weekLimit) },
    { title: `Próximos ${HORIZON_DAYS} días`, items: events.filter((e) => e.date > weekLimit) },
  ];
  const overdueOf: Record<View, number> = { vaccine: counts.overdueVaccine, deworming: counts.overdueDeworming, control: counts.overdueControl, treatment: 0 };

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><HeartPulse className="h-5 w-5 text-primary" aria-hidden /> Salud</h1>
        <p className="text-sm text-muted-foreground">Vacunas, desparasitaciones y controles de los perros del centro.</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Qué ver">
        {VIEWS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          const overdue = overdueOf[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className={cn("block text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {isLoading ? "…" : overdue ? `${overdue} vencida${overdue === 1 ? "" : "s"}` : key === "treatment" ? `${counts[key]} ${counts[key] === 1 ? "perro" : "perros"}` : `${counts[key]} ${counts[key] === 1 ? "próxima" : "próximas"}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {isLoading || !data ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : view === "treatment" ? (
        <TreatmentList dogs={data.dogs} base={base} />
      ) : groups.every((g) => g.items.length === 0) ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nada vencido ni para los próximos {HORIZON_DAYS} días.
        </p>
      ) : (
        groups.filter((g) => g.items.length).map((g) => (
          <section key={g.title} className="space-y-1.5">
            <h2 className={cn("text-xs font-semibold uppercase tracking-wide", g.danger ? "text-destructive" : "text-muted-foreground")}>
              {g.title} ({g.items.length})
            </h2>
            <ul className="divide-y rounded-lg border">
              {g.items.map((e, i) => (
                <li key={`${e.dogId}-${e.label}-${i}`}>
                  <Link
                    to={`${base}/worker/dog/${e.dogId}?salud=${DOG_TAB[e.type]}`}
                    className="flex items-center gap-3 p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-sm font-medium tabular-nums">{format(parseDateOnly(e.date), "d MMM", { locale: es })}</p>
                      <p className={cn("text-xs", e.overdue ? "text-destructive" : "text-muted-foreground")}>{relativeDay(e.date)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.dogName}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.label}{e.estimated ? " · fecha estimada" : ""}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {view !== "treatment" && events.some((e) => e.estimated) && (
        <p className="text-xs text-muted-foreground">
          “Fecha estimada”: el registro no traía próxima dosis; se calcula a 1 año para vacunas y 3 meses para desparasitaciones.
        </p>
      )}
    </div>
  );
}

function TreatmentList({ dogs, base }: { dogs: NonNullable<ReturnType<typeof useClinicDashboard>["data"]>["dogs"]; base: string }) {
  const treated = dogs.filter((d) => d.medications.length || d.conditions.length);
  if (treated.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ningún perro en tratamiento.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {treated.map((d) => (
        <li key={d.id}>
          <Link to={`${base}/worker/dog/${d.id}?salud=${d.conditions.length ? "condiciones" : "historial"}`}
            className="block p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-sm font-medium">{d.name}</p>
            {d.medications.map((m) => (
              <p key={m.name} className="text-xs text-muted-foreground">
                💊 {[m.name, m.dose, m.frequency].filter(Boolean).join(" · ")}{m.until ? ` · hasta ${format(parseDateOnly(m.until), "d MMM", { locale: es })}` : ""}
              </p>
            ))}
            {d.conditions.map((c) => (
              <p key={c.name} className="text-xs text-muted-foreground">
                {c.name} · {CONDITION_STATUS_LABELS[c.status] ?? c.status} · {CONDITION_SEVERITY_LABELS[c.severity] ?? c.severity}
              </p>
            ))}
          </Link>
        </li>
      ))}
    </ul>
  );
}
