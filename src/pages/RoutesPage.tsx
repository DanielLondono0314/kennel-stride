import { useMemo, useState } from "react";
import {
  useCandidateReservationsForRoute,
  useDrivers,
  useRoutesToday,
  useCreateDailyRoute,
  type RouteType,
} from "@/hooks/queries/useRoutes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Truck, ArrowUp, ArrowDown, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  route_pickup: "Recogida (AM)",
  route_dropoff: "Entrega (PM)",
};

const STOP_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  en_route: "En camino",
  notified: "Notificado",
  arrived: "Llegó",
  completed: "Completado",
  skipped: "Omitido",
};

export default function RoutesPage() {
  const [routeType, setRouteType] = useState<RouteType>("route_pickup");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [driverId, setDriverId] = useState<string>("");

  const { data: candidates = [], isLoading: loadingCandidates, isError, refetch } =
    useCandidateReservationsForRoute(routeType);
  const { data: drivers = [] } = useDrivers();
  const { data: routesToday = [] } = useRoutesToday(routeType);
  const createRoute = useCreateDailyRoute();

  const orderedSelection = useMemo(
    () => selectedIds.filter((id) => candidates.some((c) => c.id === id)),
    [selectedIds, candidates]
  );

  function toggle(id: string, geocoded: boolean) {
    if (!geocoded) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      const next = idx + dir;
      if (idx === -1 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  async function handleCreate() {
    if (!driverId || orderedSelection.length === 0) return;
    try {
      await createRoute.mutateAsync({ routeType, assigneeStaffId: driverId, reservationIds: orderedSelection });
      toast({ title: "Ruta creada", description: `${orderedSelection.length} paradas asignadas.` });
      setSelectedIds([]);
      setDriverId("");
    } catch (err: any) {
      toast({ title: "No se pudo crear la ruta", description: err?.message ?? "Inténtalo de nuevo", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-accent" />
            Rutas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Servicio de transporte puerta a puerta</p>
        </div>
        <Select value={routeType} onValueChange={(v) => { setRouteType(v as RouteType); setSelectedIds([]); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="route_pickup">Recogida (AM)</SelectItem>
            <SelectItem value="route_dropoff">Entrega (PM)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Armar ruta de hoy — {ROUTE_TYPE_LABELS[routeType]}
          </h2>

          {isError ? (
            <QueryErrorState onRetry={() => refetch()} />
          ) : loadingCandidates ? (
            <CardGridSkeleton count={3} />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay reservas de hoy pendientes de transporte.</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const geocoded = !!c.customers?.address_lat && !!c.customers?.address_lng;
                const selected = selectedIds.includes(c.id);
                const orderIdx = orderedSelection.indexOf(c.id);
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${!geocoded ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={!geocoded}
                      onCheckedChange={() => toggle(c.id, geocoded)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.dogs?.name} — {c.customers?.first_name} {c.customers?.last_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {c.customers?.address || "Sin dirección"}
                        {!geocoded && " · Dirección no verificada"}
                      </p>
                    </div>
                    {selected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary">{orderIdx + 1}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => move(c.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => move(c.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Elegir chofer" /></SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreate}
              disabled={!driverId || orderedSelection.length === 0 || createRoute.isPending}
            >
              Crear ruta ({orderedSelection.length} paradas)
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Rutas de hoy</h2>
        {routesToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin rutas creadas hoy.</p>
        ) : (
          routesToday.map((task: any) => (
            <Card key={task.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Chofer: {task.staff_members ? `${task.staff_members.first_name} ${task.staff_members.last_name}` : "Sin asignar"}
                    </p>
                  </div>
                  <Badge variant={task.status === "done" ? "secondary" : "default"}>
                    {task.status === "done" ? "Completada" : "En curso"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {(task.route_stops ?? [])
                    .sort((a: any, b: any) => a.sequence - b.sequence)
                    .map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border-t pt-1 first:border-t-0 first:pt-0">
                        <span>{s.sequence}. {s.dogs?.name} — {s.customers?.first_name} {s.customers?.last_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {STOP_STATUS_LABELS[s.status] ?? s.status}
                          {s.eta_minutes != null ? ` · ~${s.eta_minutes} min` : ""}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
