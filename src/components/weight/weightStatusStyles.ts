import { TrendingDown, TrendingUp, Minus, CircleDashed, CircleDot } from "lucide-react";
import type { WeightStatus } from "@/lib/weightTrend";

/** Color semántico por estado. Pérdida = crítico, aumento = advertencia. */
export const WEIGHT_STATUS_STYLES: Record<WeightStatus, { chip: string; dot: string; icon: typeof TrendingDown }> = {
  loss: { chip: "bg-destructive/10 text-destructive", dot: "bg-destructive", icon: TrendingDown },
  gain: { chip: "bg-warning/15 text-[hsl(26,83%,30%)]", dot: "bg-warning", icon: TrendingUp },
  stable: { chip: "bg-success/10 text-success", dot: "bg-success", icon: Minus },
  single: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60", icon: CircleDot },
  no_data: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/30", icon: CircleDashed },
};
