import { useMemo, useState } from "react";
import {
  useDogWeightLog, useDeleteWeightLog, type WeightEntry,
} from "@/hooks/queries/useDogWeightLog";
import { useDogDashboardConfig } from "@/hooks/queries/useDogDashboard";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListSkeleton } from "@/components/shared/TableSkeleton";
import { WeightTrendChart } from "@/components/weight/WeightTrendChart";
import { WeightEntryDialog } from "@/components/weight/WeightEntryDialog";
import { WeightStatusBadge, WeighInOverdueBadge } from "@/components/weight/WeightStatusBadge";
import { Plus, Scale, Trash2, Stethoscope, AlertTriangle, UserRound } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { parseDateOnly } from "@/lib/age";
import {
  analyzeWeight, formatKg, formatSignedKg, formatSignedPct, DEFAULT_WEIGHT_SETTINGS,
} from "@/lib/weightTrend";
import { cn } from "@/lib/utils";

interface Props { dogId: string; dogName: string; }

/** "26,2% (2,1 kg)" sin signo: el verbo (pérdida/aumento) ya da la dirección. */
const formatKgPct = (pct: number, kg: number) =>
  `${Math.abs(pct).toLocaleString("es", { maximumFractionDigits: 1 })}% (${formatKg(Math.abs(kg))})`;

function Stat({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground leading-tight mt-0.5">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

export function WeightTab({ dogId, dogName }: Props) {
  const { data: entries = [], isLoading } = useDogWeightLog(dogId);
  const { data: config } = useDogDashboardConfig();
  const deleteLog = useDeleteWeightLog(dogId);
  const canRecord = usePermission("record_weight");
  const canDelete = usePermission("delete_weight");
  const settings = config?.weight ?? DEFAULT_WEIGHT_SETTINGS;

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const analysis = useMemo(
    () => analyzeWeight(entries.map((e) => ({ date: e.date, weight: e.weight })), settings),
    [entries, settings],
  );
  const latestBcs = [...entries].reverse().find((e) => e.bodyConditionScore)?.bodyConditionScore ?? null;
  const alerting = analysis.status === "loss" || analysis.status === "gain";

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLog.mutateAsync(deleteId);
      toast.success("Registro eliminado");
    } catch {
      toast.error("No se pudo eliminar", { description: "Inténtalo de nuevo." });
    }
    setDeleteId(null);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Hoja de pesos</h3>
          <p className="text-sm text-muted-foreground">
            Pesaje recomendado cada {settings.checkIntervalDays} días · alerta con variación de ±{settings.alertPct}% en {settings.windowDays} días
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setModalOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Registrar peso</Button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">Sin pesos registrados aún</p>
            <p className="text-sm text-muted-foreground mt-1">Registra la primera pesada para empezar a ver la tendencia de {dogName}.</p>
            {canRecord && (
              <Button className="mt-4" size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Registrar peso</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {alerting && analysis.changePct !== null && analysis.baseline && (
            <div
              role="alert"
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                analysis.status === "loss" ? "border-destructive/30 bg-destructive/5" : "border-warning/40 bg-warning/5",
              )}
            >
              <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", analysis.status === "loss" ? "text-destructive" : "text-[hsl(26,83%,30%)]")} />
              <div>
                <p className="font-medium text-foreground">
                  {analysis.status === "loss" ? "Pérdida" : "Aumento"} de {formatKgPct(analysis.changePct, analysis.changeKg!)} desde el{" "}
                  {format(parseDateOnly(analysis.baseline.date), "d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {analysis.status === "loss"
                    ? "Revisa carga de actividad, apetito y posibles síntomas; considera una valoración veterinaria."
                    : "Revisa porciones y nivel de actividad."}
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="pt-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat
                  label="Peso actual"
                  value={analysis.latest ? formatKg(analysis.latest.weight) : "—"}
                  hint={analysis.latest ? format(parseDateOnly(analysis.latest.date), "d MMM yyyy", { locale: es }) : undefined}
                />
                <Stat
                  label={`Variación (${settings.windowDays} d)`}
                  value={analysis.changePct !== null ? formatSignedPct(analysis.changePct) : "—"}
                  hint={analysis.changeKg !== null ? formatSignedKg(analysis.changeKg) : "Se necesita otra pesada"}
                />
                <Stat
                  label="Ritmo"
                  value={analysis.kgPerWeek !== null ? `${formatSignedKg(analysis.kgPerWeek)}/sem` : "—"}
                  hint={analysis.baseline ? `desde ${format(parseDateOnly(analysis.baseline.date), "d MMM", { locale: es })}` : undefined}
                />
                <Stat
                  label="Condición corporal"
                  value={latestBcs ? `${latestBcs}/9` : "—"}
                  hint={latestBcs ? (latestBcs < 4 ? "Por debajo del ideal" : latestBcs > 5 ? "Por encima del ideal" : "Ideal") : "Sin evaluar"}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WeightStatusBadge analysis={analysis} />
                {analysis.isOverdue && <WeighInOverdueBadge days={analysis.daysSinceLast} />}
                <span className="text-xs text-muted-foreground">{entries.length} pesada{entries.length !== 1 ? "s" : ""} en total</span>
              </div>
              <WeightTrendChart
                analysis={analysis}
                alertPct={settings.alertPct}
                meta={entries.map((e) => ({ date: e.date, weight: e.weight, bodyConditionScore: e.bodyConditionScore, recordedBy: e.recordedBy }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Registro de pesadas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {[...entries].reverse().map((e: WeightEntry, i, arr) => {
                  const prev = arr[i + 1];
                  const delta = prev ? e.weight - prev.weight : null;
                  return (
                    <li key={`${e.source}-${e.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                        {e.source === "medical" ? <Stethoscope className="h-4 w-4 text-muted-foreground" /> : <Scale className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-sm tabular-nums">{formatKg(e.weight)}</span>
                          {delta !== null && Math.abs(delta) >= 0.05 && (
                            <span className="text-xs text-muted-foreground tabular-nums">{formatSignedKg(Math.round(delta * 10) / 10)}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{format(parseDateOnly(e.date), "d MMM yyyy", { locale: es })}</span>
                          {e.bodyConditionScore ? <Badge variant="outline" className="text-[10px]">CC {e.bodyConditionScore}/9</Badge> : null}
                          {e.source === "medical" && <Badge variant="outline" className="text-[10px]">Historial médico</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" aria-hidden />
                            {e.recordedBy ?? "Autor no registrado"}
                          </span>
                          {e.source === "log" && (
                            <span title={e.createdAt}>· capturado {format(new Date(e.createdAt), "d MMM, HH:mm", { locale: es })}</span>
                          )}
                          {e.notes && e.source === "log" && <span className="truncate">· {e.notes}</span>}
                        </div>
                      </div>
                      {e.source === "log" && canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setDeleteId(e.id)} aria-label={`Eliminar pesada del ${e.date}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <WeightEntryDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        dogId={dogId}
        dogName={dogName}
        lastWeight={analysis.latest?.weight ?? null}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro de peso?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer y afecta la tendencia y las alertas del perro.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
