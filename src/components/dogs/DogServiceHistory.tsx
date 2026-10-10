import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardCheck, Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermission } from "@/hooks/usePermission";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { fetchAll } from "@/lib/supabaseQuery";
import { parseDateOnly } from "@/lib/age";
import { cn } from "@/lib/utils";
import {
  CATEGORY_CONFIG,
  SERVICE_CATEGORIES,
  isServiceCategory,
  readDetails,
  type ServiceCategory,
} from "@/lib/reportCardServices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/report-cards/StarRating";
import { ReportCardModal } from "@/components/report-cards/ReportCardModal";
import { ReportCardDetail } from "@/components/report-cards/ReportCardDetail";

interface DogServiceHistoryProps {
  dogId: string;
  dogName: string;
}

/**
 * Historial trazable de servicios del perro: cada report card (entrenamiento,
 * grooming/spa, consultas, paseos, guardería…) con quién lo atendió, cómo le
 * fue y el detalle propio del servicio. Es la vista "dashboard" del perro.
 */
export function DogServiceHistory({ dogId, dogName }: DogServiceHistoryProps) {
  const { organization, hasFeature } = useOrganization();
  const canWrite = usePermission("report_cards.write") && hasFeature("report_cards");
  const { labels: serviceLabels, categoryFor } = useServiceTypes();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const [filter, setFilter] = useState<ServiceCategory | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["report-cards", orgId, "dog", dogId],
    enabled: !!orgId,
    queryFn: () =>
      fetchAll((from, to) =>
        supabase
          .from("report_cards")
          .select("*, staff_members(id, first_name, last_name)")
          .eq("organization_id", orgId!)
          .eq("dog_id", dogId)
          .order("session_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
  });

  const withCategory = useMemo(
    () =>
      cards.map((rc) => ({
        ...rc,
        category: (isServiceCategory(rc.service_category) ? rc.service_category : categoryFor(rc.service_type)) as ServiceCategory,
      })),
    [cards, categoryFor]
  );

  const byCategory = useMemo(() => {
    const map = new Map<ServiceCategory, { count: number; last: string; avg: number }>();
    for (const rc of withCategory) {
      const cur = map.get(rc.category);
      if (!cur) map.set(rc.category, { count: 1, last: rc.session_date, avg: rc.overall_score });
      else map.set(rc.category, { count: cur.count + 1, last: cur.last, avg: cur.avg + rc.overall_score });
    }
    return SERVICE_CATEGORIES.filter((c) => map.has(c)).map((c) => {
      const v = map.get(c)!;
      return { category: c, count: v.count, last: v.last, avg: v.avg / v.count };
    });
  }, [withCategory]);

  const stats = useMemo(() => {
    const since = subDays(new Date(), 30);
    const recent = withCategory.filter((rc) => parseDateOnly(rc.session_date) >= since);
    const avg = withCategory.length
      ? withCategory.reduce((sum, rc) => sum + rc.overall_score, 0) / withCategory.length
      : null;
    return { total: withCategory.length, last30: recent.length, avg, last: withCategory[0] ?? null };
  }, [withCategory]);

  const visible = filter === "all" ? withCategory : withCategory.filter((rc) => rc.category === filter);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: typeof visible }[] = [];
    for (const rc of visible) {
      const d = parseDateOnly(rc.session_date);
      const key = format(d, "yyyy-MM");
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: format(d, "MMMM yyyy", { locale: es }), items: [] };
        groups.push(g);
      }
      g.items.push(rc);
    }
    return groups;
  }, [visible]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["report-cards", orgId] });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const lastDays = stats.last ? differenceInCalendarDays(new Date(), parseDateOnly(stats.last.session_date)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Servicios recibidos</h2>
          <p className="text-sm text-muted-foreground">Todo lo que {dogName} ha recibido, quién lo atendió y cómo le fue.</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditData(null); setModalOpen(true); }} className="gap-2 print:hidden">
            <Plus className="h-4 w-4" /> Registrar servicio
          </Button>
        )}
      </div>

      {stats.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mb-4 opacity-50" />
            <p>Aún no hay servicios registrados para {dogName}.</p>
            <p className="text-sm mt-1">Cada report card (entrenamiento, spa, consulta, paseo…) aparecerá aquí.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Servicios registrados" value={String(stats.total)} />
            <Kpi label="Últimos 30 días" value={String(stats.last30)} />
            <Kpi
              label="Calificación promedio"
              value={stats.avg != null ? stats.avg.toFixed(1) : "—"}
              icon={<Star className="h-4 w-4 fill-warning text-warning" aria-hidden />}
            />
            <Kpi
              label="Último servicio"
              value={lastDays === 0 ? "Hoy" : lastDays === 1 ? "Ayer" : `Hace ${lastDays} días`}
              hint={stats.last ? `${CATEGORY_CONFIG[stats.last.category].icon} ${serviceLabels[stats.last.service_type] ?? CATEGORY_CONFIG[stats.last.category].label}` : undefined}
            />
          </div>

          {/* Por tipo de servicio (también sirve de filtro) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="group" aria-label="Filtrar por tipo de servicio">
            {byCategory.map((c) => {
              const cfg = CATEGORY_CONFIG[c.category];
              const active = filter === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(active ? "all" : c.category)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{cfg.icon} {cfg.label}</span>
                    <span className="text-lg font-bold tabular-nums">{c.count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Último: {format(parseDateOnly(c.last), "d MMM yyyy", { locale: es })} · ★ {c.avg.toFixed(1)}
                  </p>
                </button>
              );
            })}
          </div>

          {filter !== "all" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Mostrando solo {CATEGORY_CONFIG[filter].label.toLowerCase()}.</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFilter("all")}>Ver todo</Button>
            </div>
          )}

          {/* Línea de tiempo */}
          <div className="space-y-6">
            {grouped.map((g) => (
              <section key={g.key} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">{g.label}</h3>
                <ol className="relative space-y-2 border-l pl-5 ml-2">
                  {g.items.map((rc) => {
                    const cfg = CATEGORY_CONFIG[rc.category];
                    const details = readDetails(rc.details);
                    const staff = rc.staff_members ? `${rc.staff_members.first_name} ${rc.staff_members.last_name}` : null;
                    return (
                      <li key={rc.id} className="relative">
                        <span
                          className="absolute -left-[33px] top-3 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-xs"
                          aria-hidden
                        >
                          {cfg.icon}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetail(rc)}
                          className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">
                                {serviceLabels[rc.service_type] ?? details.service_label ?? rc.service_type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseDateOnly(rc.session_date), "EEEE d 'de' MMMM", { locale: es })}
                                {staff && ` · ${details.staff_label ?? cfg.staffLabel}: ${staff}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StarRating value={rc.overall_score} readonly size="sm" />
                              <Badge variant={rc.is_sent ? "default" : "secondary"} className="text-xs">
                                {rc.is_sent ? "Enviado" : "Borrador"}
                              </Badge>
                            </div>
                          </div>
                          {details.summary && details.summary.length > 0 && (
                            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              {details.summary.slice(0, 3).map((s) => (
                                <div key={s.label} className="min-w-0 max-w-full">
                                  <dt className="inline text-muted-foreground">{s.label}: </dt>
                                  <dd className="inline">{s.value.length > 80 ? `${s.value.slice(0, 80)}…` : s.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          {(rc.highlights || rc.notes) && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                              {rc.highlights ? `✨ ${rc.highlights}` : rc.notes}
                            </p>
                          )}
                          {rc.photos && rc.photos.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {rc.photos.slice(0, 4).map((url: string) => (
                                <img key={url} src={url} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded object-cover border" />
                              ))}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}

      <ReportCardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editData={editData}
        defaultDogId={dogId}
        onSaved={invalidate}
      />
      <ReportCardDetail
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        reportCard={detail}
        staffName={detail?.staff_members ? `${detail.staff_members.first_name} ${detail.staff_members.last_name}` : undefined}
        onEdit={canWrite ? () => { setEditData(detail); setDetail(null); setModalOpen(true); } : undefined}
      />
    </div>
  );
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <Card className="card-kpi">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold flex items-center gap-1.5 mt-0.5">{icon}{value}</p>
        {hint && <p className="text-xs text-muted-foreground truncate mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
