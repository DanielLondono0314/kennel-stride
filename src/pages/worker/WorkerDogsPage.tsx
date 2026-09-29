import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Home, Search, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkerDogs } from "@/hooks/queries/useWorkerDogs";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { useUrlState } from "@/hooks/useUrlState";
import { feedingSummary } from "@/lib/dogCare";
import { cn } from "@/lib/utils";
import { DogAlertChips, DogAvatar } from "@/components/worker/dogs/DogBits";

type View = "center" | "all";

/** Perros para el trabajador: los que están hoy en el centro, o todos con búsqueda. */
export default function WorkerDogsPage() {
  const base = useOrgBasePath();
  const { data: dogs = [], isLoading } = useWorkerDogs();
  const [searchParams] = useSearchParams();
  const [urlView, setView] = useUrlState<View>("vista", "center", { replace: true });
  const [search, setSearch] = useState("");

  const inCenter = useMemo(() => dogs.filter((d) => d.inCenter), [dogs]);
  // Si nadie eligió pestaña y no hay perros con check-in (ninguno ocupa perrera),
  // se abre en "Todos": una lista vacía hacía pensar que no había perros.
  const view: View =
    !searchParams.has("vista") && !isLoading && inCenter.length === 0 && dogs.length > 0 ? "all" : urlView;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = view === "center" ? inCenter : dogs;
    if (!q) return list;
    return list.filter((d) =>
      [d.name, d.breed, d.ownerName ?? "", d.kennelName ?? ""].some((s) => s.toLowerCase().includes(q))
    );
  }, [dogs, inCenter, view, search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Perros</h1>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Qué perros ver">
        {([["center", `En el centro (${inCenter.length})`], ["all", `Todos (${dogs.length})`]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              view === v ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, raza, dueño o perrera"
          aria-label="Buscar perro"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search.trim()
            ? `Sin resultados para "${search.trim()}".`
            : view === "center"
              ? "Aún no hay perros con check-in: ninguno ocupa una perrera."
              : "No hay perros registrados."}
          {!search.trim() && view === "center" && dogs.length > 0 && (
            <button
              type="button"
              onClick={() => setView("all")}
              className="mt-3 block w-full rounded-lg border bg-card py-2.5 font-medium text-foreground hover:bg-muted/50"
            >
              Ver los {dogs.length} perros registrados
            </button>
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => {
            const feeding = feedingSummary(d.feeding);
            return (
              <li key={d.id}>
                <Link
                  to={`${base}/worker/dog/${d.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <DogAvatar photoUrl={d.photoUrl} name={d.name} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{d.name}</p>
                      {d.kennelName && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                          <Home className="h-3 w-3" aria-hidden /> {d.kennelName}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.breed}{d.ownerName ? ` · ${d.ownerName}` : ""}
                    </p>
                    {feeding && (
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <UtensilsCrossed className="h-3 w-3 shrink-0" aria-hidden /> {feeding}
                      </p>
                    )}
                    <DogAlertChips flags={d.flags} />
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
