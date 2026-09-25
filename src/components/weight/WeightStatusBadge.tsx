import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEIGHT_STATUS_LABELS, formatSignedPct, type WeightAnalysis } from "@/lib/weightTrend";
import { WEIGHT_STATUS_STYLES } from "./weightStatusStyles";

interface Props {
  analysis: WeightAnalysis;
  /** Muestra el % junto a la etiqueta en vez del texto largo. */
  compact?: boolean;
  className?: string;
}

export function WeightStatusBadge({ analysis, compact, className }: Props) {
  const style = WEIGHT_STATUS_STYLES[analysis.status];
  const Icon = style.icon;
  const hasChange = analysis.changePct !== null;
  const label = compact && hasChange ? formatSignedPct(analysis.changePct!) : WEIGHT_STATUS_LABELS[analysis.status];

  return (
    <span
      className={cn("status-badge whitespace-nowrap", style.chip, className)}
      title={hasChange ? `${WEIGHT_STATUS_LABELS[analysis.status]} (${formatSignedPct(analysis.changePct!)})` : undefined}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function WeighInOverdueBadge({ days, className }: { days: number | null; className?: string }) {
  return (
    <span className={cn("status-badge whitespace-nowrap bg-info/10 text-[hsl(199,89%,32%)]", className)}>
      <Clock className="h-3 w-3" aria-hidden />
      {days === null ? "Nunca pesado" : `Pesaje vencido · ${days} d`}
    </span>
  );
}
