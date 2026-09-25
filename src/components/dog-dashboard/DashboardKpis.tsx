import type { DashboardDog } from "@/hooks/queries/useDogDashboard";
import { needsAttention, type Segment } from "./model";
import { cn } from "@/lib/utils";

interface Props {
  dogs: DashboardDog[];
  segment: Segment;
  onSegment: (s: Segment) => void;
}

interface Tile {
  segment: Segment | null;
  label: string;
  value: string;
  detail: string;
  /** 0-1 para un medidor bajo el valor. */
  ratio?: number;
  tone?: "critical" | "neutral";
}

/**
 * Fila de indicadores en una sola superficie con divisores (no una rejilla de
 * tarjetas iguales). Las cifras que corresponden a un segmento son botones y
 * filtran el listado.
 */
export function DashboardKpis({ dogs, segment, onSegment }: Props) {
  const total = dogs.length;
  const inCenter = dogs.filter((d) => d.stay.state === "in_center").length;
  const attention = dogs.filter(needsAttention).length;
  const weightLoss = dogs.filter((d) => d.weight.status === "loss").length;
  const upToDate = dogs.filter((d) => !d.weight.isOverdue).length;
  const withPlan = dogs.filter((d) => d.plan.state !== "none").length;
  const special = dogs.filter((d) => d.flags.medication || d.flags.allergies || d.flags.aggressive).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const tiles: Tile[] = [
    { segment: "all", label: "Perros activos", value: total.toLocaleString("es"), detail: `${inCenter} en el centro ahora` },
    {
      segment: "attention", label: "Requieren atención", value: attention.toLocaleString("es"),
      detail: weightLoss ? `${weightLoss} con pérdida de peso` : "Sin pérdidas de peso",
      tone: weightLoss ? "critical" : "neutral",
    },
    { segment: "overdue", label: "Pesaje al día", value: `${pct(upToDate)}%`, detail: `${total - upToDate} pendientes de pesar`, ratio: total ? upToDate / total : 0 },
    { segment: "no_plan", label: "Con plan vigente", value: `${pct(withPlan)}%`, detail: `${total - withPlan} sin plan activo`, ratio: total ? withPlan / total : 0 },
    { segment: null, label: "Cuidados especiales", value: special.toLocaleString("es"), detail: "Medicación, alergias o manejo" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-px rounded-lg border bg-border overflow-hidden">
      {tiles.map((t, i) => {
        const selectable = t.segment !== null;
        const selected = selectable && segment === t.segment && t.segment !== "all";
        const Comp = selectable ? "button" : "div";
        return (
          <Comp
            key={t.label}
            {...(selectable ? { type: "button" as const, onClick: () => onSegment(selected ? "all" : t.segment!), "aria-pressed": selected } : {})}
            className={cn(
              "relative flex flex-col items-start justify-start bg-card p-4 text-left transition-colors",
              i === 0 && "col-span-2 lg:col-span-1",
              selectable && "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
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
            <p className={cn("mt-1.5 text-xs", t.tone === "critical" ? "text-destructive font-medium" : "text-muted-foreground")}>{t.detail}</p>
            {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden />}
          </Comp>
        );
      })}
    </div>
  );
}
