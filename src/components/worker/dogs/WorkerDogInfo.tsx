import { Link } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle, CalendarCheck, ChevronRight, ClipboardCheck, Home, Leaf, Phone, Pill, ShieldAlert, Star, Syringe, UtensilsCrossed,
} from "lucide-react";
import { getAge, parseDateOnly } from "@/lib/age";
import { telHref } from "@/lib/contact";
import { ALLERGY_TYPE_LABELS, FOOD_TYPE_LABELS, MED_ROUTE_LABELS, SEVERITY_LABELS } from "@/lib/dogCare";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import type { WorkerDogProfile } from "@/hooks/queries/useWorkerDogs";
import { cn } from "@/lib/utils";
import { DogAvatar } from "./DogBits";
import { PlanCard } from "@/components/plans/PlanCard";

function Section({
  icon: Icon, title, tone = "default", children,
}: {
  icon: typeof Home;
  title: string;
  tone?: "default" | "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  const toneCls = {
    default: "border-border",
    danger: "border-destructive/40 bg-destructive/5",
    warning: "border-warning/40 bg-warning/5",
    info: "border-info/40 bg-info/5",
  }[tone];
  const iconCls = { default: "text-muted-foreground", danger: "text-destructive", warning: "text-warning", info: "text-info" }[tone];
  return (
    <section className={cn("rounded-lg border p-3 space-y-2", toneCls)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("h-4 w-4", iconCls)} aria-hidden /> {title}
      </h3>
      <div className="space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

/** Cabecera: foto, nombre, raza, edad, perrera. */
export function WorkerDogHeader({ dog }: { dog: WorkerDogProfile }) {
  return (
    <div className="flex items-center gap-4">
      <DogAvatar photoUrl={dog.photoUrl} name={dog.name} size="lg" />
      <div className="min-w-0">
        <h1 className="text-xl font-bold truncate">{dog.name}</h1>
        <p className="text-sm text-muted-foreground">
          {dog.breed} · {dog.gender === "male" ? "Macho" : "Hembra"}
          {dog.isNeutered ? (dog.gender === "male" ? " castrado" : " esterilizada") : ""} · {getAge(dog.birthDate, "edad desconocida")}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm">
          <Home className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {dog.kennelName ? <span className="font-medium">{dog.kennelName}</span> : <span className="text-muted-foreground">No está en una perrera</span>}
        </p>
      </div>
    </div>
  );
}

/**
 * Información de cuidado del perro, ordenada por urgencia: primero lo que
 * puede causar un accidente (agresividad, alergias, medicación, vacunas),
 * luego la rutina (alimentación) y al final el contexto (notas, dueño,
 * últimos report cards). `compact` muestra solo lo esencial para una tarea.
 */
export function WorkerDogInfo({ dog, compact = false }: { dog: WorkerDogProfile; compact?: boolean }) {
  const base = useOrgBasePath();
  const { labels: serviceLabels } = useServiceTypes();
  const today = new Date();
  const activeMeds = dog.medications.filter((m) => !m.endDate || parseDateOnly(m.endDate) >= parseDateOnly(format(today, "yyyy-MM-dd")));
  const overdueVaccines = dog.vaccines.filter((v) => v.nextDoseDate && differenceInCalendarDays(parseDateOnly(v.nextDoseDate), today) < 0);
  const a = dog.aggression;
  const f = dog.feeding;

  return (
    <div className="space-y-3">
      {a && (
        <Section icon={ShieldAlert} title="Precaución: agresivo" tone="danger">
          {a.severity && <Row label="Severidad" value={SEVERITY_LABELS[a.severity] ?? a.severity} />}
          {(a.requiresMuzzle || a.handleAlone || a.noOtherDogs) && (
            <ul className="flex flex-wrap gap-1.5">
              {a.requiresMuzzle && <li className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">Usar bozal</li>}
              {a.handleAlone && <li className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">Manejar solo</li>}
              {a.noOtherDogs && <li className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">Sin otros perros</li>}
            </ul>
          )}
          {a.handling && <p className="whitespace-pre-wrap">{a.handling}</p>}
        </Section>
      )}

      {dog.allergies.length > 0 && (
        <Section icon={Leaf} title="Alergias" tone="warning">
          <ul className="space-y-1">
            {dog.allergies.map((al) => (
              <li key={al.id}>
                <span className="font-medium">{al.allergen}</span>
                <span className="text-muted-foreground">
                  {" "}· {ALLERGY_TYPE_LABELS[al.type] ?? al.type}
                  {al.severity ? ` · ${SEVERITY_LABELS[al.severity] ?? al.severity}` : ""}
                  {al.reaction ? ` · ${al.reaction}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {activeMeds.length > 0 && (
        <Section icon={Pill} title="Medicación" tone="info">
          <ul className="space-y-1.5">
            {activeMeds.map((m) => (
              <li key={m.id}>
                <p className="font-medium">{m.name}{m.dose ? ` — ${m.dose}` : ""}</p>
                <p className="text-muted-foreground">
                  {[m.frequency, m.route ? MED_ROUTE_LABELS[m.route] ?? m.route : null, m.withFood ? "con comida" : null].filter(Boolean).join(" · ") || "Sin indicaciones"}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {overdueVaccines.length > 0 && (
        <Section icon={Syringe} title="Vacunas vencidas" tone="danger">
          <ul className="space-y-1">
            {overdueVaccines.map((v) => (
              <li key={v.id} className="flex justify-between gap-3">
                <span className="font-medium">{v.name}</span>
                <span className="text-destructive">desde {format(parseDateOnly(v.nextDoseDate!), "d MMM", { locale: es })}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Plan: lo que le toca a este perro (ej. reporte por WhatsApp, clases grupales). Sin precio. */}
      {dog.plan && (
        <Section icon={CalendarCheck} title="Plan">
          <PlanCard plan={dog.plan} compact={compact} showPrice={false} />
        </Section>
      )}

      <Section icon={UtensilsCrossed} title="Alimentación">
        {f ? (
          <>
            {f.foodType && <Row label="Comida" value={FOOD_TYPE_LABELS[f.foodType] ?? f.foodType} />}
            {f.brand && <Row label="Marca" value={f.brand} />}
            {f.mealsPerDay && <Row label="Comidas al día" value={f.mealsPerDay} />}
            {f.portion && <Row label="Porción" value={f.portion} />}
            {f.instructions && <p className="rounded bg-muted/60 p-2">{f.instructions}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">Sin indicaciones de alimentación registradas.</p>
        )}
      </Section>

      {!compact && (
        <>
          {(dog.behaviorNotes || dog.medicalNotes || dog.notes) && (
            <Section icon={AlertTriangle} title="Notas">
              {dog.behaviorNotes && <p><span className="font-medium">Comportamiento: </span>{dog.behaviorNotes}</p>}
              {dog.medicalNotes && <p><span className="font-medium">Médicas: </span>{dog.medicalNotes}</p>}
              {dog.notes && <p><span className="font-medium">Generales: </span>{dog.notes}</p>}
            </Section>
          )}

          {dog.owner && (
            <Section icon={Phone} title="Dueño">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{dog.owner.name}</span>
                {dog.owner.phone && (
                  <a
                    href={telHref(dog.owner.phone) ?? undefined}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    <Phone className="h-4 w-4" aria-hidden /> Llamar
                  </a>
                )}
              </div>
            </Section>
          )}

          <Section icon={ClipboardCheck} title="Últimos servicios">
            {dog.reports.length === 0 ? (
              <p className="text-muted-foreground">Sin report cards todavía.</p>
            ) : (
              <ul className="space-y-2">
                {dog.reports.map((r) => (
                  <li key={r.id} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{serviceLabels[r.serviceType] ?? r.serviceType}</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden /> {r.overallScore}/5 ·{" "}
                        {format(parseDateOnly(r.sessionDate), "d MMM", { locale: es })}
                      </span>
                    </div>
                    {(r.highlights || r.notes) && <p className="text-muted-foreground line-clamp-2">{r.highlights || r.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {compact && (
        <Link
          to={`${base}/worker/dog/${dog.id}`}
          className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted/50"
        >
          Ver ficha completa de {dog.name}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
