import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DogCharacteristicIcons } from "@/components/dogs/DogCharacteristicIcons";
import { WeightSparkline } from "@/components/weight/WeightSparkline";
import { WeightStatusBadge, WeighInOverdueBadge } from "@/components/weight/WeightStatusBadge";
import type { DashboardDog } from "@/hooks/queries/useDogDashboard";
import type { CardField } from "@/lib/dogDashboardConfig";
import { parseDateOnly } from "@/lib/age";
import { formatKg } from "@/lib/weightTrend";
import { FOOD_TYPE_LABELS, PLAN_STATE_LABELS } from "./model";
import { Home, CalendarDays, UtensilsCrossed, Ticket, Syringe, ClipboardCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Fields = Record<CardField, boolean>;

const shortDate = (d: string) => format(parseDateOnly(d), "d MMM", { locale: es });

export function DogAvatar({ dog, className }: { dog: DashboardDog; className?: string }) {
  return (
    <Avatar className={cn("h-11 w-11", className)}>
      <AvatarImage src={dog.photoUrl ?? undefined} alt="" className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{dog.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function StayLabel({ dog }: { dog: DashboardDog }) {
  if (dog.stay.state === "in_center") {
    return (
      <span className="status-badge status-checked-in">
        <Home className="h-3 w-3" aria-hidden />
        En el centro{dog.kennel ? ` · ${dog.kennel}` : ""}
      </span>
    );
  }
  if (dog.stay.state === "upcoming" && dog.stay.startDate) {
    return (
      <span className="status-badge status-scheduled">
        <CalendarDays className="h-3 w-3" aria-hidden />
        Llega el {shortDate(dog.stay.startDate)}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Sin estancia próxima</span>;
}

export function PlanSummary({ dog, compact }: { dog: DashboardDog; compact?: boolean }) {
  const p = dog.plan;
  if (p.state === "none") return <span className="text-xs text-muted-foreground">{PLAN_STATE_LABELS.none}</span>;
  const ratio = p.total ? p.remaining / p.total : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{p.name}</span>
        <span className={cn("shrink-0 tabular-nums", p.state === "expiring" ? "font-medium text-[hsl(26,83%,30%)]" : "text-muted-foreground")}>
          {p.remaining}/{p.total}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-primary/10" aria-hidden>
        <div className={cn("h-full rounded-full", p.state === "expiring" ? "bg-warning" : "bg-primary")} style={{ width: `${ratio * 100}%` }} />
      </div>
      {!compact && p.expiresAt && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {p.state === "expiring" ? "Por vencer · " : ""}vence {format(new Date(p.expiresAt), "d MMM yyyy", { locale: es })}
          {p.extraCount > 0 ? ` · +${p.extraCount} bono${p.extraCount > 1 ? "s" : ""}` : ""}
        </p>
      )}
    </div>
  );
}

function FeedingLine({ dog }: { dog: DashboardDog }) {
  const f = dog.feeding;
  if (!f || (!f.foodType && !f.brand)) return <span className="text-muted-foreground">Sin registrar</span>;
  return (
    <span className="truncate">
      {[f.foodType && FOOD_TYPE_LABELS[f.foodType], f.brand, f.mealsPerDay && `${f.mealsPerDay}×/día`, f.portion].filter(Boolean).join(" · ")}
    </span>
  );
}

// ── Tarjeta ──────────────────────────────────────────────────────────────────

export function DogRosterCard({ dog, fields, onOpen }: { dog: DashboardDog; fields: Fields; onOpen: () => void }) {
  const w = dog.weight;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <DogAvatar dog={dog} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-foreground">{dog.name}</p>
            {fields.health && (
              <DogCharacteristicIcons isAggressive={dog.flags.aggressive} hasAllergies={dog.flags.allergies} onMedication={dog.flags.medication} />
            )}
          </div>
          {fields.breedAge && <p className="truncate text-xs text-muted-foreground">{dog.breed} · {dog.age}</p>}
          {fields.owner && dog.owner && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <UserRound className="h-3 w-3 shrink-0" aria-hidden />{dog.owner.name}
            </p>
          )}
        </div>
      </div>

      {fields.weight && (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-none text-foreground">{w.latest ? formatKg(w.latest.weight) : "—"}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <WeightStatusBadge analysis={w} compact />
              {w.isOverdue && w.latest && <WeighInOverdueBadge days={w.daysSinceLast} />}
            </div>
          </div>
          <WeightSparkline points={w.points} status={w.status} />
        </div>
      )}

      {(fields.plan || fields.feeding || fields.location || fields.vaccines || fields.lastReport || (fields.behavior && dog.aggression)) && (
        <div className="mt-4 space-y-2.5 border-t pt-3 text-xs">
          {fields.location && <StayLabel dog={dog} />}
          {fields.plan && (
            <div className="flex items-start gap-2">
              <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1"><PlanSummary dog={dog} /></div>
            </div>
          )}
          {fields.feeding && (
            <p className="flex items-center gap-2 text-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <FeedingLine dog={dog} />
            </p>
          )}
          {fields.vaccines && (
            <p className="flex items-center gap-2">
              <Syringe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {dog.vaccines.overdue.length ? (
                <span className="font-medium text-destructive">Vencida: {dog.vaccines.overdue.join(", ")}</span>
              ) : dog.vaccines.nextDate ? (
                <span className="text-foreground">Próxima dosis {shortDate(dog.vaccines.nextDate)}</span>
              ) : (
                <span className="text-muted-foreground">Sin esquema registrado</span>
              )}
            </p>
          )}
          {fields.lastReport && (
            <p className="flex items-center gap-2">
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {dog.lastReport ? (
                <span className="text-foreground">
                  {shortDate(dog.lastReport.date)} · energía {dog.lastReport.energy}/5 · apetito {dog.lastReport.appetite}/5
                </span>
              ) : (
                <span className="text-muted-foreground">Sin report cards recientes</span>
              )}
            </p>
          )}
          {fields.behavior && dog.aggression && (
            <p className="rounded-md bg-destructive/5 px-2 py-1.5 text-destructive">
              Manejo especial{dog.aggression.requiresMuzzle ? " · bozal" : ""}{dog.aggression.noOtherDogs ? " · sin otros perros" : ""}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

// ── Tabla ────────────────────────────────────────────────────────────────────

export function DogRosterTable({ dogs, fields, onOpen }: { dogs: DashboardDog[]; fields: Fields; onOpen: (d: DashboardDog) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Perro</TableHead>
            {fields.owner && <TableHead>Dueño</TableHead>}
            {fields.weight && <TableHead>Peso</TableHead>}
            {fields.weight && <TableHead>Tendencia</TableHead>}
            {fields.plan && <TableHead className="min-w-[160px]">Plan activo</TableHead>}
            {fields.feeding && <TableHead>Alimentación</TableHead>}
            {fields.location && <TableHead>Estancia</TableHead>}
            {fields.vaccines && <TableHead>Vacunas</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dogs.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer"
              onClick={() => onOpen(d)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(d); } }}
              tabIndex={0}
              aria-label={`Abrir ficha de ${d.name}`}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <DogAvatar dog={d} className="h-8 w-8" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{d.name}</span>
                      {fields.health && <DogCharacteristicIcons isAggressive={d.flags.aggressive} hasAllergies={d.flags.allergies} onMedication={d.flags.medication} />}
                    </div>
                    {fields.breedAge && <p className="text-xs text-muted-foreground">{d.breed} · {d.age}</p>}
                  </div>
                </div>
              </TableCell>
              {fields.owner && <TableCell className="text-sm">{d.owner?.name ?? "—"}</TableCell>}
              {fields.weight && (
                <TableCell>
                  <p className="font-medium tabular-nums">{d.weight.latest ? formatKg(d.weight.latest.weight) : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.weight.daysSinceLast === null ? "Nunca pesado" : d.weight.daysSinceLast === 0 ? "Hoy" : `Hace ${d.weight.daysSinceLast} d`}
                  </p>
                </TableCell>
              )}
              {fields.weight && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <WeightSparkline points={d.weight.points} status={d.weight.status} width={72} height={24} />
                    <WeightStatusBadge analysis={d.weight} compact />
                  </div>
                </TableCell>
              )}
              {fields.plan && <TableCell><PlanSummary dog={d} compact /></TableCell>}
              {fields.feeding && <TableCell className="max-w-[220px] text-xs"><FeedingLine dog={d} /></TableCell>}
              {fields.location && <TableCell><StayLabel dog={d} /></TableCell>}
              {fields.vaccines && (
                <TableCell className="text-xs">
                  {d.vaccines.overdue.length
                    ? <span className="font-medium text-destructive">{d.vaccines.overdue.length} vencida{d.vaccines.overdue.length > 1 ? "s" : ""}</span>
                    : d.vaccines.nextDate ? `Próx. ${shortDate(d.vaccines.nextDate)}` : <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
