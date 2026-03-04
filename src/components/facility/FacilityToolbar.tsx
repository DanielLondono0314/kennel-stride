import { Button } from "@/components/ui/button";
import { 
  Dog, Droplets, UtensilsCrossed, Dumbbell, Scissors, 
  TreePine, DoorOpen, Archive, Plus 
} from "lucide-react";

export interface ZoneTypeConfig {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  defaultCapacity: number;
}

export const ZONE_TYPES: ZoneTypeConfig[] = [
  { type: "kennels", label: "Perreras", icon: Dog, color: "hsl(var(--flag-critical))", defaultCapacity: 8 },
  { type: "cleaning", label: "Limpieza", icon: Droplets, color: "hsl(var(--status-scheduled))", defaultCapacity: 2 },
  { type: "feeding", label: "Comidas", icon: UtensilsCrossed, color: "hsl(var(--flag-warning))", defaultCapacity: 4 },
  { type: "training", label: "Entrenamiento", icon: Dumbbell, color: "hsl(var(--status-ready))", defaultCapacity: 2 },
  { type: "grooming", label: "Grooming", icon: Scissors, color: "hsl(var(--status-in-progress))", defaultCapacity: 3 },
  { type: "play_yard", label: "Patio", icon: TreePine, color: "hsl(var(--flag-success))", defaultCapacity: 10 },
  { type: "reception", label: "Recepción", icon: DoorOpen, color: "hsl(var(--info))", defaultCapacity: 1 },
  { type: "storage", label: "Almacén", icon: Archive, color: "hsl(var(--muted-foreground))", defaultCapacity: 0 },
];

interface FacilityToolbarProps {
  onAddZone: (zoneType: ZoneTypeConfig) => void;
}

export function FacilityToolbar({ onAddZone }: FacilityToolbarProps) {
  return (
    <div className="w-56 shrink-0 border-r bg-card p-4 space-y-3 overflow-y-auto scrollbar-thin">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Zonas</h3>
      <p className="text-xs text-muted-foreground">Haz clic para agregar al mapa</p>
      <div className="space-y-1.5">
        {ZONE_TYPES.map((zt) => {
          const Icon = zt.icon;
          return (
            <Button
              key={zt.type}
              variant="ghost"
              className="w-full justify-start gap-3 h-10 text-sm font-medium hover:bg-secondary"
              onClick={() => onAddZone(zt)}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: zt.color + "20", color: zt.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span>{zt.label}</span>
              <Plus className="h-3 w-3 ml-auto text-muted-foreground" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
