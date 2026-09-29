import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightLeft, ChevronRight, Loader2, LogOut, Search, Wrench, CheckCircle2, Dog } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { useWorkerDogs } from "@/hooks/queries/useWorkerDogs";
import { useKennelActions, type WorkerKennel, type WorkerKennelZone } from "@/hooks/queries/useWorkerKennels";
import { DogAlertChips, DogAvatar } from "@/components/worker/dogs/DogBits";

type Mode = "view" | "assign" | "move";

const STATUS_LABELS = { available: "Disponible", occupied: "Ocupada", maintenance: "En mantenimiento" } as const;

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Inténtalo de nuevo.";
}

/** Detalle de una perrera y sus acciones (asignar, mover, liberar, mantenimiento, notas). */
export function KennelSheet({
  kennel, zones, canManage, onOpenChange,
}: {
  kennel: WorkerKennel | null;
  zones: WorkerKennelZone[];
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const base = useOrgBasePath();
  const actions = useKennelActions();
  const { data: dogs = [] } = useWorkerDogs();
  const [mode, setMode] = useState<Mode>("view");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setMode("view");
    setSearch("");
    setNotes(kennel?.notes ?? "");
  }, [kennel?.id, kennel?.notes]);

  const freeKennels = useMemo(
    () => zones.flatMap((z) => z.kennels.filter((k) => k.status === "available" && k.id !== kennel?.id).map((k) => ({ ...k, zoneName: z.name }))),
    [zones, kennel?.id]
  );
  const assignableDogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dogs.filter((d) => !d.inCenter && (!q || d.name.toLowerCase().includes(q) || (d.ownerName ?? "").toLowerCase().includes(q)));
  }, [dogs, search]);

  const busy = Object.values(actions).some((m) => m.isPending);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      onOpenChange(false);
    } catch (e) {
      toast.error("No se pudo guardar", { description: errorMessage(e) });
    }
  }

  if (!kennel) return null;

  return (
    <Sheet open={!!kennel} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-md overflow-y-auto rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>{kennel.name}</SheetTitle>
          <SheetDescription>{STATUS_LABELS[kennel.status]}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Ocupante */}
          {kennel.status === "occupied" && kennel.dogName && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <DogAvatar photoUrl={kennel.dogPhotoUrl} name={kennel.dogName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{kennel.dogName}</p>
                  {kennel.since && (
                    <p className="text-xs text-muted-foreground">
                      Aquí desde hace {formatDistanceToNow(new Date(kennel.since), { locale: es })}
                    </p>
                  )}
                </div>
                {kennel.dogId && (
                  <Link to={`${base}/worker/dog/${kennel.dogId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Ficha <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </div>
              <DogAlertChips flags={kennel.flags} />
            </div>
          )}

          {mode === "view" && (
            <>
              {kennel.status === "maintenance" && kennel.notes && (
                <p className="rounded-lg bg-warning/10 p-3 text-sm">{kennel.notes}</p>
              )}

              {canManage ? (
                <div className="grid gap-2">
                  {kennel.status === "occupied" && (
                    <>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => setMode("move")} disabled={busy}>
                        <ArrowRightLeft className="h-4 w-4" /> Mover a otra perrera
                      </Button>
                      {kennel.reservationId ? (
                        <p className="text-xs text-muted-foreground">
                          Esta perrera está ligada a una reserva con check-in: se libera sola al hacer el check-out.
                        </p>
                      ) : (
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          disabled={busy}
                          onClick={() => run(() => actions.release.mutateAsync(kennel.id), `${kennel.name} liberada`)}
                        >
                          <LogOut className="h-4 w-4" /> Liberar perrera
                        </Button>
                      )}
                    </>
                  )}

                  {kennel.status === "available" && (
                    <>
                      <Button className="justify-start gap-2" onClick={() => setMode("assign")} disabled={busy}>
                        <Dog className="h-4 w-4" /> Asignar un perro
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start gap-2"
                        disabled={busy}
                        onClick={() => run(() => actions.setStatus.mutateAsync({ id: kennel.id, status: "maintenance", notes }), `${kennel.name} en mantenimiento`)}
                      >
                        <Wrench className="h-4 w-4" /> Poner en mantenimiento
                      </Button>
                    </>
                  )}

                  {kennel.status === "maintenance" && (
                    <Button
                      className="justify-start gap-2"
                      disabled={busy}
                      onClick={() => run(() => actions.setStatus.mutateAsync({ id: kennel.id, status: "available", notes: "" }), `${kennel.name} disponible`)}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marcar como disponible
                    </Button>
                  )}

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="kennel-notes">Notas de la perrera</Label>
                    <Textarea
                      id="kennel-notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej. puerta dañada, bebedero con fuga…"
                    />
                    {notes !== (kennel.notes ?? "") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => run(() => actions.setNotes.mutateAsync({ id: kennel.id, notes: notes.trim() }), "Notas guardadas")}
                      >
                        Guardar notas
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {kennel.notes ? <>{kennel.notes}<br /><br /></> : null}
                  Para asignar, mover o cambiar el estado de perreras, pide a un administrador el permiso
                  <span className="font-medium text-foreground"> Gestionar perreras</span>.
                </p>
              )}
            </>
          )}

          {mode === "assign" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar perro o dueño"
                  aria-label="Buscar perro para asignar"
                  className="pl-9"
                />
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {assignableDogs.length === 0 ? (
                  <li className="py-6 text-center text-sm text-muted-foreground">No hay perros disponibles para asignar.</li>
                ) : (
                  assignableDogs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => actions.assign.mutateAsync({ id: kennel.id, dogId: d.id, dogName: d.name }), `${d.name} asignado a ${kennel.name}`)}
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted disabled:opacity-50"
                      >
                        <DogAvatar photoUrl={d.photoUrl} name={d.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{d.breed}{d.ownerName ? ` · ${d.ownerName}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <Button variant="ghost" className="w-full" onClick={() => setMode("view")}>Cancelar</Button>
            </div>
          )}

          {mode === "move" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Elige la perrera disponible a la que pasa {kennel.dogName}:</p>
              {freeKennels.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay perreras disponibles.</p>
              ) : (
                <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                  {freeKennels.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => actions.move.mutateAsync({ fromId: kennel.id, toId: k.id }), `${kennel.dogName} movido a ${k.name}`)}
                      className="rounded-md border p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <span className="block font-medium">{k.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{k.zoneName}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setMode("view")}>Cancelar</Button>
            </div>
          )}

          {busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
