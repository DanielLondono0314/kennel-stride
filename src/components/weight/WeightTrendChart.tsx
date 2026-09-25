import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateOnly } from "@/lib/age";
import { formatKg, type WeightAnalysis } from "@/lib/weightTrend";

export interface TrendPointMeta {
  date: string;
  weight: number;
  bodyConditionScore?: number | null;
  recordedBy?: string | null;
  notes?: string | null;
}

interface Props {
  analysis: WeightAnalysis;
  alertPct: number;
  /** Detalle por pesada para el tooltip (opcional). */
  meta?: TrendPointMeta[];
  height?: number;
}

interface ChartRow {
  t: number;
  date: string;
  peso: number;
  details: TrendPointMeta[];
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const d = row.details[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md min-w-[160px]">
      <p className="font-medium text-foreground">{format(parseDateOnly(row.date), "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{formatKg(row.peso)}</p>
      {d?.bodyConditionScore ? <p className="text-muted-foreground">Condición corporal: {d.bodyConditionScore}/9</p> : null}
      {d?.recordedBy ? <p className="text-muted-foreground">Registró: {d.recordedBy}</p> : null}
      {row.details.length > 1 ? <p className="text-muted-foreground">{row.details.length} pesadas ese día (promedio)</p> : null}
    </div>
  );
}

/**
 * Tendencia de peso sobre eje de tiempo real, con la banda "normal" (±alertPct
 * alrededor de la pesada de referencia) sombreada: un punto fuera de la banda
 * es exactamente lo que dispara la alerta.
 */
export function WeightTrendChart({ analysis, alertPct, meta = [], height = 240 }: Props) {
  const rows = useMemo<ChartRow[]>(() => {
    const metaByDate = new Map<string, TrendPointMeta[]>();
    for (const m of meta) {
      const list = metaByDate.get(m.date) ?? [];
      list.push(m);
      metaByDate.set(m.date, list);
    }
    return analysis.points.map((p) => ({
      t: parseDateOnly(p.date).getTime(),
      date: p.date,
      peso: p.weight,
      details: metaByDate.get(p.date) ?? [],
    }));
  }, [analysis.points, meta]);

  const band = useMemo(() => {
    const base = analysis.baseline?.weight;
    return base ? { y1: base * (1 - alertPct / 100), y2: base * (1 + alertPct / 100) } : null;
  }, [analysis.baseline?.weight, alertPct]);

  const domain = useMemo(() => {
    const ws = rows.map((r) => r.peso);
    if (band) ws.push(band.y1, band.y2);
    const min = Math.min(...ws);
    const max = Math.max(...ws);
    const pad = Math.max(0.5, (max - min) * 0.15);
    return [Math.max(0, Math.floor((min - pad) * 2) / 2), Math.ceil((max + pad) * 2) / 2];
  }, [rows, band]);

  const latestT = rows.at(-1)?.t;
  const singleDay = rows.length === 1;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          {band && (
            <ReferenceArea
              y1={band.y1}
              y2={band.y2}
              fill="hsl(var(--success))"
              fillOpacity={0.07}
              stroke="none"
              ifOverflow="extendDomain"
              label={{
                value: `Rango normal ±${alertPct}%`,
                position: "insideTopLeft",
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
          )}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={singleDay ? ["dataMin - 86400000", "dataMax + 86400000"] : ["dataMin", "dataMax"]}
            tickFormatter={(t: number) => format(new Date(t), "d MMM", { locale: es })}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={24}
          />
          <YAxis
            domain={domain}
            tickFormatter={(v: number) => `${v.toLocaleString("es")} kg`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="peso"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: ChartRow; index?: number }) => {
              const isLatest = props.payload?.t === latestT;
              return (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={isLatest ? 5 : 3.5}
                  fill={isLatest ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
