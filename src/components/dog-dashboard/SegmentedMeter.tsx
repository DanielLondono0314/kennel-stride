import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface MeterSegment<K extends string> {
  key: K;
  label: string;
  count: number;
  /** Clase de fondo para el segmento y el punto de la leyenda. */
  colorClass: string;
  icon?: LucideIcon;
}

interface Props<K extends string> {
  segments: MeterSegment<K>[];
  total: number;
  active?: K | "";
  onSelect?: (key: K | "") => void;
  ariaLabel: string;
}

/**
 * Parte-de-un-todo como una sola barra apilada + leyenda con conteos.
 * La leyenda es el control: al hacer clic filtra el listado de perros
 * (y vuelve a hacer clic para quitar el filtro). El color nunca va solo:
 * cada segmento tiene etiqueta, conteo e ícono en la leyenda.
 */
export function SegmentedMeter<K extends string>({ segments, total, active, onSelect, ariaLabel }: Props<K>) {
  const visible = segments.filter((s) => s.count > 0);

  return (
    <div className="space-y-4">
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
      >
        {visible.map((s) => (
          <div
            key={s.key}
            className={cn(
              "h-full transition-opacity first:rounded-l-full last:rounded-r-full",
              s.colorClass,
              active && active !== s.key && "opacity-25",
            )}
            style={{ width: `${(s.count / Math.max(1, total)) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      <ul className="space-y-0.5">
        {segments.map((s) => {
          const pct = total ? Math.round((s.count / total) * 100) : 0;
          const isActive = active === s.key;
          const Icon = s.icon;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!onSelect || s.count === 0}
                onClick={() => onSelect?.(isActive ? "" : s.key)}
                aria-pressed={isActive}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  onSelect && s.count > 0 && "hover:bg-muted",
                  isActive && "bg-muted",
                  s.count === 0 && "opacity-60",
                )}
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.colorClass)} aria-hidden />
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="flex-1 truncate text-foreground">{s.label}</span>
                <span className="tabular-nums font-medium text-foreground">{s.count}</span>
                <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
