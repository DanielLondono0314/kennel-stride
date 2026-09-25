import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDogWeightLog } from "@/hooks/queries/useDogWeightLog";
import { usePermission } from "@/hooks/usePermission";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import type { DashboardDog } from "@/hooks/queries/useDogDashboard";
import type { CardField } from "@/lib/dogDashboardConfig";
import { parseDateOnly } from "@/lib/age";
import { analyzeWeight, formatKg, formatSignedKg, formatSignedPct, type WeightSettings } from "@/lib/weightTrend";
import { WeightTrendChart } from "@/components/weight/WeightTrendChart";
import { WeightEntryDialog } from "@/components/weight/WeightEntryDialog";
import { WeightStatusBadge, WeighInOverdueBadge } from "@/components/weight/WeightStatusBadge";
import { DogAvatar, PlanSummary, StayLabel } from "./DogRoster";
import { attentionReasons, FOOD_TYPE_LABELS, SEVERITY_LABELS } from "./model";
import {
  Scale, ExternalLink, UtensilsCrossed, Ticket, HeartPulse, ShieldAlert, Home, ClipboardCheck, Phone, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  dog: DashboardDog | null;
  onOpenChange: (open: boolean) => void;
  settings: WeightSettings;
  fields: Record<CardField, boolean>;
}

function Section({ icon: Icon, title, children }: { icon: typeof Scale; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />{title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular-nums font-medium">{value}/5</span></div>
      <div className="mt-1 flex gap-[2px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 first:rounded-l-full last:rounded-r-full", i <= value ? "bg-primary" : "bg-primary/10")} />
        ))}
      </div>
    </div>
  );
}

export function DogDetailSheet({ dog, onOpenChange, settings, fields }: Props) {
  const orgNavigate = useOrgNavigate();
  const canRecord = usePermission("record_weight");
  const [weighOpen, setWeighOpen] = useState(false);
  const { data: entries, isLoading } = useDogWeightLog(dog?.id);

  // La hoja completa (todas las fechas + autor) reemplaza al resumen del panel en cuanto carga.
  const analysis = useMemo(
    () => (entries ? analyzeWeight(entries.map((e) => ({ date: e.date, weight: e.weight })), settings) : dog?.weight),
    [entries, settings, dog?.weight],
  );
  const lastEntry = entries?.at(-1);

  if (!dog || !analysis) return null;
  const reasons = attentionReasons(dog);

  return (
    <>
      <Sheet open={!!dog} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="space-y-0 text-left">
            <div className="flex items-start gap-4 pr-6">
              <DogAvatar dog={dog} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-xl">{dog.name}</SheetTitle>
                <SheetDescription>
                  {dog.breed} · {dog.age} · {dog.gender === "male" ? "Macho" : "Hembra"}{dog.isNeutered ? " esterilizado" : ""}
                </SheetDescription>
                {dog.owner && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dog.owner.name}
                    {dog.owner.phone && (
                      <a href={`tel:${dog.owner.phone}`} className="ml-2 inline-flex items-center gap-1 text-foreground hover:underline">
                        <Phone className="h-3 w-3" aria-hidden />{dog.owner.phone}
                      </a>
                    )}
                  </p>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 flex flex-wrap gap-2">
            {canRecord && (
              <Button size="sm" onClick={() => setWeighOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Registrar peso</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => orgNavigate(`/dogs/${dog.id}`)}>
              <ExternalLink className="mr-1.5 h-4 w-4" />Perfil completo
            </Button>
          </div>

          {reasons.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              {reasons.map((r) => (
                <li key={r.kind} className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", r.severity === 0 ? "bg-destructive" : r.severity === 1 ? "bg-warning" : "bg-info")} aria-hidden />
                  <span className="text-foreground">{r.label}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Section icon={Scale} title="Peso">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="text-lg font-semibold">{analysis.latest ? formatKg(analysis.latest.weight) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variación</p>
                  <p className="text-lg font-semibold">{analysis.changePct !== null ? formatSignedPct(analysis.changePct) : "—"}</p>
                  {analysis.changeKg !== null && <p className="text-xs text-muted-foreground">{formatSignedKg(analysis.changeKg)}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último pesaje</p>
                  <p className="text-lg font-semibold">{analysis.latest ? format(parseDateOnly(analysis.latest.date), "d MMM", { locale: es }) : "—"}</p>
                  {lastEntry?.recordedBy && <p className="truncate text-xs text-muted-foreground">por {lastEntry.recordedBy}</p>}
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <WeightStatusBadge analysis={analysis} />
                {analysis.isOverdue && <WeighInOverdueBadge days={analysis.daysSinceLast} />}
              </div>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : analysis.points.length > 0 ? (
                <WeightTrendChart
                  analysis={analysis}
                  alertPct={settings.alertPct}
                  height={200}
                  meta={(entries ?? []).map((e) => ({ date: e.date, weight: e.weight, bodyConditionScore: e.bodyConditionScore, recordedBy: e.recordedBy }))}
                />
              ) : (
                <p className="rounded-md bg-muted/50 py-6 text-center text-sm text-muted-foreground">Aún no hay pesadas registradas.</p>
              )}
            </Section>

            {fields.location && (
              <Section icon={Home} title="Estancia">
                <StayLabel dog={dog} />
                {dog.stay.startDate && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {dog.stay.serviceName} · {format(new Date(dog.stay.startDate), "d MMM", { locale: es })}
                    {dog.stay.endDate ? ` → ${format(new Date(dog.stay.endDate), "d MMM", { locale: es })}` : ""}
                  </p>
                )}
              </Section>
            )}

            {fields.plan && (
              <Section icon={Ticket} title="Plan activo">
                <PlanSummary dog={dog} />
              </Section>
            )}

            {fields.feeding && (
              <Section icon={UtensilsCrossed} title="Alimentación">
                {dog.feeding ? (
                  <>
                    <Row label="Tipo" value={dog.feeding.foodType ? FOOD_TYPE_LABELS[dog.feeding.foodType] ?? dog.feeding.foodType : "—"} />
                    <Row label="Marca" value={dog.feeding.brand ?? "—"} />
                    <Row label="Comidas al día" value={dog.feeding.mealsPerDay ?? "—"} />
                    <Row label="Porción" value={dog.feeding.portion ?? "—"} />
                    {dog.feeding.instructions && (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm text-foreground">{dog.feeding.instructions}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos de alimentación.</p>
                )}
              </Section>
            )}

            {fields.health && (
              <Section icon={HeartPulse} title="Salud">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Alergias</p>
                {dog.allergies.length ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {dog.allergies.map((a) => (
                      <Badge key={a.allergen} variant="outline" className="border-destructive/30 text-destructive">
                        {a.allergen}{a.severity ? ` · ${SEVERITY_LABELS[a.severity] ?? a.severity}` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : <p className="mb-3 text-sm text-muted-foreground">Ninguna registrada</p>}

                <p className="mb-1 text-xs font-medium text-muted-foreground">Medicación activa</p>
                {dog.medications.length ? (
                  <ul className="mb-3 space-y-1 text-sm">
                    {dog.medications.map((m) => (
                      <li key={m.name} className="text-foreground">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">{[m.dose, m.frequency, m.withFood && "con comida"].filter(Boolean).map((s) => ` · ${s}`).join("")}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mb-3 text-sm text-muted-foreground">Ninguna</p>}

                <p className="mb-1 text-xs font-medium text-muted-foreground">Vacunas</p>
                {dog.vaccines.overdue.length > 0 && <p className="text-sm font-medium text-destructive">Vencidas: {dog.vaccines.overdue.join(", ")}</p>}
                {dog.vaccines.dueSoon.length > 0 && <p className="text-sm text-foreground">Próximas (30 días): {dog.vaccines.dueSoon.join(", ")}</p>}
                {!dog.vaccines.overdue.length && !dog.vaccines.dueSoon.length && (
                  <p className="text-sm text-muted-foreground">
                    {dog.vaccines.nextDate ? `Al día · próxima ${format(parseDateOnly(dog.vaccines.nextDate), "d MMM yyyy", { locale: es })}` : "Sin esquema registrado"}
                  </p>
                )}
              </Section>
            )}

            {fields.behavior && (dog.aggression || dog.behaviorNotes) && (
              <Section icon={ShieldAlert} title="Comportamiento">
                {dog.aggression && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {dog.aggression.severity && <Badge variant="outline" className="border-destructive/30 text-destructive">Agresividad {SEVERITY_LABELS[dog.aggression.severity]?.toLowerCase() ?? dog.aggression.severity}</Badge>}
                    {dog.aggression.requiresMuzzle && <Badge variant="outline">Requiere bozal</Badge>}
                    {dog.aggression.noOtherDogs && <Badge variant="outline">Sin otros perros</Badge>}
                  </div>
                )}
                {dog.aggression?.handling && <p className="text-sm text-foreground">{dog.aggression.handling}</p>}
                {dog.behaviorNotes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{dog.behaviorNotes}</p>}
              </Section>
            )}

            {fields.lastReport && dog.lastReport && (
              <Section icon={ClipboardCheck} title={`Último report card · ${format(parseDateOnly(dog.lastReport.date), "d MMM", { locale: es })}`}>
                <div className="grid grid-cols-3 gap-4">
                  <Rating label="Energía" value={dog.lastReport.energy} />
                  <Rating label="Apetito" value={dog.lastReport.appetite} />
                  <Rating label="General" value={dog.lastReport.overall} />
                </div>
              </Section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <WeightEntryDialog
        open={weighOpen}
        onOpenChange={setWeighOpen}
        dogId={dog.id}
        dogName={dog.name}
        lastWeight={analysis.latest?.weight ?? null}
      />
    </>
  );
}
