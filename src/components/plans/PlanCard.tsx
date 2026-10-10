import { Price } from "@/components/shared/Price";
import { CalendarRange, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_STATE_LABELS, planProgressPct, planProgressText, planState, type DogPlan, type PlanState } from "@/lib/dogPlans";

const STATE_STYLE: Record<PlanState, string> = {
  upcoming: "bg-info/10 text-info",
  active: "bg-success/10 text-success",
  expiring: "bg-warning/15 text-warning",
  expired: "bg-destructive/10 text-destructive",
  depleted: "bg-destructive/10 text-destructive",
  finished: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const BAR_STYLE: Partial<Record<PlanState, string>> = {
  active: "bg-success",
  expiring: "bg-warning",
  expired: "bg-destructive",
  depleted: "bg-destructive",
};

/** Resumen de un plan: servicio, estado, progreso, qué incluye y condiciones. */
export function PlanCard({ plan, compact = false, showPrice = true }: { plan: DogPlan; compact?: boolean; showPrice?: boolean }) {
  const state = planState(plan);
  const pct = planProgressPct(plan);
  const Icon = plan.billing === "quantity" ? Hash : CalendarRange;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{plan.service_label}</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {planProgressText(plan)}
          </p>
        </div>
        <Badge className={cn("shrink-0 border-0", STATE_STYLE[state])}>{PLAN_STATE_LABELS[state]}</Badge>
      </div>

      {(state === "active" || state === "expiring") && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
          <div className={cn("h-full rounded-full", BAR_STYLE[state])} style={{ width: `${pct}%` }} />
        </div>
      )}

      {plan.includes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plan.includes.map((i) => (
            <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{i}</span>
          ))}
        </div>
      )}

      {!compact && plan.conditions && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{plan.conditions}</p>}
      {!compact && showPrice && plan.price > 0 && (
        <p className="text-xs text-muted-foreground">Valor del plan: <span className="font-medium text-foreground"><Price value={plan.price} /></span></p>
      )}
    </div>
  );
}
