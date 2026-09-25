import { useMemo } from "react";
import type { WeightPoint, WeightStatus } from "@/lib/weightTrend";
import { parseDateOnly } from "@/lib/age";

interface Props {
  points: WeightPoint[];
  status: WeightStatus;
  width?: number;
  height?: number;
}

const END_COLOR: Record<WeightStatus, string> = {
  loss: "hsl(var(--destructive))",
  gain: "hsl(var(--warning))",
  stable: "hsl(var(--success))",
  single: "hsl(var(--muted-foreground))",
  no_data: "hsl(var(--muted-foreground))",
};

/**
 * Mini tendencia de peso (tiempo real en el eje X, no índice): línea en tono
 * neutro y el punto final con el color del estado — el estado ya se lee en el
 * badge de texto al lado, así que el color nunca es el único canal.
 */
export function WeightSparkline({ points, status, width = 96, height = 28 }: Props) {
  const geometry = useMemo(() => {
    const recent = points.slice(-12);
    if (recent.length < 2) return null;
    const xs = recent.map((p) => parseDateOnly(p.date).getTime());
    const ys = recent.map((p) => p.weight);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    // Evita exagerar variaciones mínimas: rango vertical de al menos ±3% del peso.
    const minSpan = (y0 + y1) / 2 * 0.06;
    if (y1 - y0 < minSpan) {
      const mid = (y0 + y1) / 2;
      y0 = mid - minSpan / 2;
      y1 = mid + minSpan / 2;
    }
    const pad = 4;
    const sx = (x: number) => pad + ((x - x0) / Math.max(1, x1 - x0)) * (width - pad * 2);
    const sy = (y: number) => height - pad - ((y - y0) / (y1 - y0)) * (height - pad * 2);
    const coords = recent.map((p, i) => [sx(xs[i]), sy(p.weight)] as const);
    return { d: coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" "), end: coords.at(-1)! };
  }, [points, width, height]);

  if (!geometry) {
    return <div style={{ width, height }} className="flex items-center"><div className="h-px w-full bg-border" /></div>;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={geometry.d} fill="none" stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={geometry.end[0]} cy={geometry.end[1]} r={3.5} fill={END_COLOR[status]} stroke="hsl(var(--card))" strokeWidth={2} />
    </svg>
  );
}
