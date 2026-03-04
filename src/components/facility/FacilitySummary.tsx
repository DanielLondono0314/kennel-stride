import { Dog, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { ZONE_TYPES } from "./FacilityToolbar";

interface ZoneData {
  id: string;
  name: string;
  zone_type: string;
}

interface UnitData {
  id: string;
  zone_id: string;
  status: string;
  assigned_dog_name: string | null;
  assignment_end: string | null;
}

interface FacilitySummaryProps {
  zones: ZoneData[];
  units: UnitData[];
}

export function FacilitySummary({ zones, units }: FacilitySummaryProps) {
  const totalUnits = units.length;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const available = units.filter((u) => u.status === "available").length;
  const maintenance = units.filter((u) => u.status === "maintenance").length;

  const expiringSoon = units.filter((u) => {
    if (!u.assignment_end || u.status !== "occupied") return false;
    const days = differenceInDays(parseISO(u.assignment_end), new Date());
    return days <= 2 && days >= 0;
  });

  const expired = units.filter((u) => {
    if (!u.assignment_end || u.status !== "occupied") return false;
    return differenceInDays(parseISO(u.assignment_end), new Date()) < 0;
  });

  const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  return (
    <div className="w-60 shrink-0 border-l bg-card p-4 space-y-5 overflow-y-auto scrollbar-thin">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Resumen</h3>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-muted text-center">
          <p className="text-lg font-bold text-foreground">{occupancyRate}%</p>
          <p className="text-[10px] text-muted-foreground">Ocupación</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted text-center">
          <p className="text-lg font-bold text-foreground">{totalUnits}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Dog className="h-3.5 w-3.5 text-[hsl(var(--flag-critical))]" />
          <span className="text-muted-foreground flex-1">Ocupadas</span>
          <span className="font-semibold text-foreground">{occupied}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--flag-success))]" />
          <span className="text-muted-foreground flex-1">Disponibles</span>
          <span className="font-semibold text-foreground">{available}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Wrench className="h-3.5 w-3.5 text-[hsl(var(--flag-warning))]" />
          <span className="text-muted-foreground flex-1">Mantenimiento</span>
          <span className="font-semibold text-foreground">{maintenance}</span>
        </div>
      </div>

      {/* Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--flag-warning))]" />
            Alertas
          </h4>
          {expired.map((u) => (
            <div key={u.id} className="notice-critical rounded p-2 text-[11px]">
              <span className="font-medium">{u.assigned_dog_name}</span>: periodo vencido
            </div>
          ))}
          {expiringSoon.map((u) => {
            const days = differenceInDays(parseISO(u.assignment_end!), new Date());
            return (
              <div key={u.id} className="notice-warning rounded p-2 text-[11px]">
                <span className="font-medium">{u.assigned_dog_name}</span>: {days === 0 ? "vence hoy" : `${days}d restante${days > 1 ? "s" : ""}`}
              </div>
            );
          })}
        </div>
      )}

      {/* Per-zone breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground">Por Zona</h4>
        {zones.map((z) => {
          const zoneUnits = units.filter((u) => u.zone_id === z.id);
          const zOccupied = zoneUnits.filter((u) => u.status === "occupied").length;
          const zt = ZONE_TYPES.find((t) => t.type === z.zone_type);
          return (
            <div key={z.id} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: zt?.color }} />
              <span className="truncate flex-1 text-muted-foreground">{z.name}</span>
              <span className="font-medium text-foreground">{zOccupied}/{zoneUnits.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
