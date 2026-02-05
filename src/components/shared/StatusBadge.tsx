import { ReservationStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  Play,
  AlertCircle,
  CheckCheck,
  XCircle,
  Loader2,
} from "lucide-react";

interface StatusBadgeProps {
  status: ReservationStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const statusConfig: Record<
  ReservationStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  [ReservationStatus.REQUESTED]: {
    label: "Solicitado",
    className: "status-requested",
    icon: AlertCircle,
  },
  [ReservationStatus.SCHEDULED]: {
    label: "Programado",
    className: "status-scheduled",
    icon: Clock,
  },
  [ReservationStatus.CHECKED_IN]: {
    label: "Registrado",
    className: "status-checked-in",
    icon: CheckCircle2,
  },
  [ReservationStatus.IN_PROGRESS]: {
    label: "En Progreso",
    className: "status-in-progress",
    icon: Loader2,
  },
  [ReservationStatus.READY]: {
    label: "Listo",
    className: "status-ready",
    icon: Play,
  },
  [ReservationStatus.PICKED_UP]: {
    label: "Recogido",
    className: "status-completed",
    icon: CheckCheck,
  },
  [ReservationStatus.COMPLETED]: {
    label: "Completado",
    className: "status-completed",
    icon: CheckCheck,
  },
  [ReservationStatus.CANCELLED]: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
    icon: XCircle,
  },
};

export function StatusBadge({ status, showIcon = true, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "status-badge",
        config.className,
        size === "sm" && "text-[10px] px-2 py-0.5"
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {config.label}
    </span>
  );
}
