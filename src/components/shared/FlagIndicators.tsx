import { FlagType, FlagSeverity, DogFlag } from "@/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Syringe,
  FileWarning,
  CreditCard,
  AlertTriangle,
  Heart,
  Star,
} from "lucide-react";

interface FlagIndicatorsProps {
  flags: DogFlag[];
  showLabels?: boolean;
  maxVisible?: number;
}

const flagConfig: Record<
  FlagType,
  { label: string; icon: typeof Syringe; color: string }
> = {
  [FlagType.VACCINATION_EXPIRED]: {
    label: "Vacuna vencida",
    icon: Syringe,
    color: "flag-critical",
  },
  [FlagType.DOCUMENT_PENDING]: {
    label: "Documento pendiente",
    icon: FileWarning,
    color: "flag-warning",
  },
  [FlagType.PAYMENT_OVERDUE]: {
    label: "Pago vencido",
    icon: CreditCard,
    color: "flag-critical",
  },
  [FlagType.BEHAVIOR_ALERT]: {
    label: "Alerta de comportamiento",
    icon: AlertTriangle,
    color: "flag-warning",
  },
  [FlagType.MEDICAL_CONDITION]: {
    label: "Condición médica",
    icon: Heart,
    color: "flag-info",
  },
  [FlagType.VIP_CLIENT]: {
    label: "Cliente VIP",
    icon: Star,
    color: "flag-success",
  },
};

const severityColors: Record<FlagSeverity, string> = {
  [FlagSeverity.CRITICAL]: "text-flag-critical",
  [FlagSeverity.WARNING]: "text-flag-warning",
  [FlagSeverity.INFO]: "text-flag-info",
};

export function FlagIndicators({
  flags,
  showLabels = false,
  maxVisible = 3,
}: FlagIndicatorsProps) {
  if (flags.length === 0) return null;

  const visibleFlags = flags.slice(0, maxVisible);
  const hiddenCount = flags.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visibleFlags.map((flag) => {
        const config = flagConfig[flag.type];
        const Icon = config.icon;
        const colorClass = severityColors[flag.severity];

        return (
          <Tooltip key={flag.id}>
            <TooltipTrigger asChild>
              <button className={cn("p-1 rounded hover:bg-muted transition-colors", colorClass)}>
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">{flag.message}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="px-1.5 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
              +{hiddenCount}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{hiddenCount} más alertas</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
