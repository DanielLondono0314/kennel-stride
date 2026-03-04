import { cn } from "@/lib/utils";
import { Dog } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FacilityUnit {
  id: string;
  name: string;
  status: string;
  assigned_dog_name: string | null;
  assignment_end: string | null;
}

interface KennelGridProps {
  units: FacilityUnit[];
  onUnitClick: (unit: FacilityUnit) => void;
}

export function KennelGrid({ units, onUnitClick }: KennelGridProps) {
  if (units.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic p-1">Sin unidades</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 p-1">
      {units.map((unit) => {
        const daysLeft = unit.assignment_end
          ? differenceInDays(parseISO(unit.assignment_end), new Date())
          : null;

        return (
          <Tooltip key={unit.id}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); onUnitClick(unit); }}
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium truncate border transition-colors cursor-pointer",
                  unit.status === "available" && "bg-[hsl(var(--flag-success))]/10 border-[hsl(var(--flag-success))]/30 text-[hsl(var(--flag-success))]",
                  unit.status === "occupied" && "bg-[hsl(var(--flag-critical))]/10 border-[hsl(var(--flag-critical))]/30 text-[hsl(var(--flag-critical))]",
                  unit.status === "maintenance" && "bg-[hsl(var(--flag-warning))]/10 border-[hsl(var(--flag-warning))]/30 text-[hsl(var(--flag-warning))]",
                  unit.status === "reserved" && "bg-[hsl(var(--status-ready))]/10 border-[hsl(var(--status-ready))]/30 text-[hsl(var(--status-ready))]",
                )}
              >
                {unit.status === "occupied" && unit.assigned_dog_name ? (
                  <span className="flex items-center gap-0.5">
                    <Dog className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{unit.assigned_dog_name}</span>
                  </span>
                ) : (
                  unit.name
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">{unit.name}</p>
              {unit.assigned_dog_name && <p>🐕 {unit.assigned_dog_name}</p>}
              {daysLeft !== null && <p>{daysLeft > 0 ? `${daysLeft}d restantes` : "Venció"}</p>}
              <p className="capitalize">{unit.status}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
