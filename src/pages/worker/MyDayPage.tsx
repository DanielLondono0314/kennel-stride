import { useMyDay, type FeedItem } from "@/hooks/queries/useMyDay";
import { STATUS_LABELS } from "@/lib/worker";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { AlertTriangle, Pill, Leaf } from "lucide-react";

const BUCKETS = ["pending", "in_progress", "done"] as const;

export default function MyDayPage() {
  const { data = [], isLoading } = useMyDay();
  const navigate = useOrgNavigate();
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Mi día</h1>
      {BUCKETS.map((b) => {
        const items = data.filter((i) => i.bucket === b);
        if (items.length === 0) return null;
        return (
          <section key={b} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">{STATUS_LABELS[b]}</h2>
            {items.map((item: FeedItem) => (
              <button key={`${item.kind}-${item.id}`}
                onClick={() => navigate(`/worker/${item.kind}/${item.id}`)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left">
                <div>
                  <p className="font-medium">{item.dogName ?? item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.title}{item.time ? ` · ${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  {item.flags.aggressive && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {item.flags.allergies && <Leaf className="h-4 w-4 text-amber-600" />}
                  {item.flags.medication && <Pill className="h-4 w-4 text-blue-600" />}
                </div>
              </button>
            ))}
          </section>
        );
      })}
      {data.length === 0 && <p className="text-sm text-muted-foreground">No tienes trabajo asignado hoy.</p>}
    </div>
  );
}
