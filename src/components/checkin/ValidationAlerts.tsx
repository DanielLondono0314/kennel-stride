import { ValidationAlert, FlagSeverity } from "@/types";
import { cn } from "@/lib/utils";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Syringe, 
  FileText, 
  Flag, 
  CreditCard,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ValidationAlertsProps {
  alerts: ValidationAlert[];
  selectedOverrides: Set<string>;
  onToggleOverride: (alertId: string) => void;
  canOverride: boolean;
}

const severityStyles: Record<FlagSeverity, { bg: string; border: string; icon: string }> = {
  [FlagSeverity.CRITICAL]: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    icon: "text-destructive",
  },
  [FlagSeverity.WARNING]: {
    bg: "bg-warning/10",
    border: "border-warning/30",
    icon: "text-warning",
  },
  [FlagSeverity.INFO]: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    icon: "text-primary",
  },
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  vaccination: Syringe,
  document: FileText,
  flag: Flag,
  payment: CreditCard,
  package: ShieldAlert,
};

export function ValidationAlerts({
  alerts,
  selectedOverrides,
  onToggleOverride,
  canOverride,
}: ValidationAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success/20">
          <Info className="h-5 w-5 text-success" />
        </div>
        <div>
          <p className="font-medium text-success">Todo en orden</p>
          <p className="text-sm text-muted-foreground">
            Vacunas, documentos y pagos al día
          </p>
        </div>
      </div>
    );
  }

  // Sort alerts: blocking first, then by severity
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (a.blocksOperation !== b.blocksOperation) {
      return a.blocksOperation ? -1 : 1;
    }
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const blockingCount = alerts.filter(a => a.blocksOperation).length;

  return (
    <div className="space-y-3">
      {blockingCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm font-medium text-destructive">
            {blockingCount} {blockingCount === 1 ? "problema bloquea" : "problemas bloquean"} el check-in
          </p>
        </div>
      )}

      <div className="space-y-2">
        {sortedAlerts.map((alert) => {
          const styles = severityStyles[alert.severity];
          const Icon = typeIcons[alert.type] || AlertTriangle;
          const isOverridden = selectedOverrides.has(alert.id);

          return (
            <div
              key={alert.id}
              className={cn(
                "relative rounded-lg border p-4 transition-all",
                styles.bg,
                styles.border,
                isOverridden && "opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Override checkbox for blocking alerts */}
                {alert.blocksOperation && canOverride && (
                  <div className="pt-0.5">
                    <Checkbox
                      id={`override-${alert.id}`}
                      checked={isOverridden}
                      onCheckedChange={() => onToggleOverride(alert.id)}
                      className="border-muted-foreground"
                    />
                  </div>
                )}

                {/* Icon */}
                <div className={cn("flex-shrink-0 mt-0.5", styles.icon)}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{alert.title}</h4>
                    {alert.blocksOperation && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-destructive/20 text-destructive">
                        Bloquea
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {alert.message}
                  </p>

                  {/* Details */}
                  {alert.details && 'expiredAt' in alert.details && alert.details.expiredAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Venció: {format(alert.details.expiredAt, "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  )}

                  {/* Suggested action */}
                  {alert.suggestedAction && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-xs"
                      onClick={() => {
                        // TODO: route to relevant page based on action type
                      }}
                    >
                      {alert.suggestedAction.label}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Override indicator */}
              {isOverridden && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                  <span className="text-xs font-medium text-muted-foreground">
                    Override seleccionado
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
