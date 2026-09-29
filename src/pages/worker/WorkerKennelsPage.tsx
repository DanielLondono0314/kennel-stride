import { useMemo, useState } from "react";
import { StickyNote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { useWorkerKennels, type KennelStatus, type WorkerKennel } from "@/hooks/queries/useWorkerKennels";
import { cn } from "@/lib/utils";
import { KennelSheet } from "@/components/worker/kennels/KennelSheet";
import { DogAvatar } from "@/components/worker/dogs/DogBits";

type Filter = "all" | KennelStatus;

const TILE: Record<KennelStatus, string> = {
  occupied: "border-primary/40 bg-primary/5",
  available: "border-success/40 bg-success/5",
  maintenance: "border-warning/50 bg-warning/10",
};

/**
 * Perreras en la app del trabajador: ver ocupación y, con el permiso
 * "Gestionar perreras", asignar, mover, liberar y poner en mantenimiento.
 * Quien se encarga de las perreras no tiene acceso al panel administrativo.
 */
export default function WorkerKennelsPage() {
  const { data: zones = [], isLoading } = useWorkerKennels();
  const canManage = usePermission("manage_facility");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = useMemo(() => zones.flatMap((z) => z.kennels), [zones]);
  const counts = {
    occupied: all.filter((k) => k.status === "occupied").length,
    available: all.filter((k) => k.status === "available").length,
    maintenance: all.filter((k) => k.status === "maintenance").length,
  };
  const selected: WorkerKennel | null = all.find((k) => k.id === selectedId) ?? null;

  const filters: [Filter, string][] = [
    ["all", `Todas (${all.length})`],
    ["occupied", `Ocupadas (${counts.occupied})`],
    ["available", `Libres (${counts.available})`],
    ["maintenance", `Mantenimiento (${counts.maintenance})`],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Perreras</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar perreras">
        {filters.map(([f, label]) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-background"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : all.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">El centro no tiene perreras configuradas.</p>
      ) : (
        zones.map((zone) => {
          const kennels = zone.kennels.filter((k) => filter === "all" || k.status === filter);
          if (kennels.length === 0) return null;
          return (
            <section key={zone.id} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{zone.name}</h2>
              <div className="grid grid-cols-2 gap-2">
                {kennels.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSelectedId(k.id)}
                    className={cn(
                      "flex min-h-[76px] flex-col justify-between rounded-lg border p-2.5 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      TILE[k.status]
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold">{k.name}</span>
                      {k.notes && <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Tiene notas" />}
                    </div>
                    {k.status === "occupied" && k.dogName ? (
                      <div className="flex items-center gap-2">
                        <DogAvatar photoUrl={k.dogPhotoUrl} name={k.dogName} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{k.dogName}</span>
                          {(k.flags.aggressive || k.flags.allergies || k.flags.medication) && (
                            <span className="block truncate text-[11px] font-medium text-destructive">
                              {[k.flags.aggressive && "Agresivo", k.flags.allergies && "Alergias", k.flags.medication && "Medicación"].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className={cn("text-xs font-medium", k.status === "maintenance" ? "text-warning" : "text-success")}>
                        {k.status === "maintenance" ? "En mantenimiento" : "Libre"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

      <KennelSheet kennel={selected} zones={zones} canManage={canManage} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
}
