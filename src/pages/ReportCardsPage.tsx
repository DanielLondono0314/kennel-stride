import { usePermission } from "@/hooks/usePermission";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { REPORT_CARDS_PAGE_SIZE, useReportCards, useReportCardStats } from "@/hooks/queries/useReportCards";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StarRating } from "@/components/report-cards/StarRating";
import { ReportCardModal } from "@/components/report-cards/ReportCardModal";
import { ReportCardDetail } from "@/components/report-cards/ReportCardDetail";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Search, FileText, Send, Pencil, Trash2, Dog, ChevronLeft, ChevronRight } from "lucide-react";
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { parseDateOnly } from "@/lib/age";
import { CATEGORY_CONFIG, SERVICE_CATEGORIES, isServiceCategory, readDetails, type ServiceCategory } from "@/lib/reportCardServices";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
}

type StatusFilter = "all" | "draft" | "sent";

function staffName(s: { first_name: string; last_name: string } | null | undefined) {
  return s ? `${s.first_name} ${s.last_name}`.trim() : undefined;
}

export default function ReportCardsPage() {
  const { organization } = useOrganization();
  const { labels: serviceLabels, categoryFor } = useServiceTypes();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");

  const canWrite = usePermission("report_cards.write");
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Búsqueda con debounce: el filtro se aplica en el servidor.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => { setPage(0); }, [search, filterStaff, filterCategory, filterStatus]);

  const { data, isLoading, isError, refetch } = useReportCards({
    page,
    search,
    staffId: filterStaff,
    category: filterCategory,
    status: filterStatus,
  });
  const { data: stats } = useReportCardStats();
  const reportCards = useMemo(() => data?.cards ?? [], [data?.cards]);
  const total = data?.total ?? 0;
  const pageSize = REPORT_CARDS_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = !!search || filterStaff !== "all" || filterCategory !== "all" || filterStatus !== "all";

  const orgId = organization?.id;

  // Solo para el filtro: el nombre de cada tarjeta ya viene en el join.
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("staff_members")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .order("first_name")
      .then(({ data }) => { if (data) setStaff(data); });
  }, [orgId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["report-cards", orgId] });

  function categoryOfCard(rc: any): ServiceCategory {
    return isServiceCategory(rc.service_category) ? rc.service_category : categoryFor(rc.service_type);
  }

  function openEdit(rc: any) {
    setEditData(rc);
    setModalOpen(true);
  }

  function openNew() {
    setEditData(null);
    setModalOpen(true);
  }

  function openDetail(rc: any) {
    setDetailData(rc);
    setDetailOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("report_cards").delete().eq("id", deleteId);
    if (error) {
      toast.error("No se pudo eliminar el report card", { description: "Inténtalo de nuevo." });
    } else {
      toast.success("Report card eliminado");
      invalidate();
    }
    setDeleteId(null);
  }

  async function handleSendToOwner(rc: any) {
    setSendingId(rc.id);
    const { data, error } = await supabase.functions.invoke("send-report-card", {
      body: { reportCardId: rc.id },
    });
    setSendingId(null);
    if (error || !data?.success) {
      const description = error
        ? await getFunctionErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo.")
        : data?.error || "Revisa tu conexión e inténtalo de nuevo.";
      toast.error("No se pudo enviar el report card", { description });
    } else {
      toast.success(`Report card de ${rc.dog_name} ${rc.is_sent ? "reenviado" : "enviado"} al dueño por correo`);
      setDetailOpen(false);
      invalidate();
    }
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setFilterStaff("all");
    setFilterCategory("all");
    setFilterStatus("all");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-accent" />
            Report Cards
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats ? `${stats.total} report cards · ${stats.drafts} borradores` : " "}
          </p>
        </div>
        {canWrite && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Report Card
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre de perro..."
            aria-label="Buscar por nombre de perro"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[190px]" aria-label="Tipo de servicio"><SelectValue placeholder="Servicio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            {SERVICE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStaff} onValueChange={setFilterStaff}>
          <SelectTrigger className="w-[180px]" aria-label="Encargado"><SelectValue placeholder="Encargado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el personal</SelectItem>
            {staff.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]" aria-label="Estado"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards grid */}
      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : reportCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Dog className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No hay report cards</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {filtersActive
              ? "No se encontraron resultados con los filtros actuales."
              : "Crea el primer report card para registrar cómo le fue a un perro en un servicio."}
          </p>
          {filtersActive && (
            <Button variant="link" onClick={clearFilters} className="mt-2">Limpiar filtros</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((rc) => {
              const cfg = CATEGORY_CONFIG[categoryOfCard(rc)];
              const details = readDetails(rc.details);
              const serviceLabel = serviceLabels[rc.service_type] ?? details.service_label ?? rc.service_type;
              const responsible = staffName(rc.staff_members);
              return (
                <Card key={rc.id} className="hover:shadow-md transition-shadow group">
                  <CardContent className="p-5">
                    <button
                      type="button"
                      onClick={() => openDetail(rc)}
                      className="block w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0" aria-hidden>
                            <span className="text-lg">{cfg.icon}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{rc.dog_name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {format(parseDateOnly(rc.session_date), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={rc.is_sent ? "default" : "secondary"} className="text-xs shrink-0">
                          {rc.is_sent ? "Enviado" : "Borrador"}
                        </Badge>
                      </div>

                      <StarRating value={rc.overall_score} readonly size="sm" />

                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{serviceLabel}</span>
                        <span aria-hidden>·</span>
                        <span>{responsible ? `${cfg.staffLabel}: ${responsible}` : "Sin encargado"}</span>
                      </div>

                      {details.summary?.[0] && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium text-foreground">{details.summary[0].label}:</span> {details.summary[0].value}
                        </p>
                      )}

                      {rc.notes && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{rc.notes}</p>
                      )}

                      {rc.photos && rc.photos.length > 0 && (
                        <div className="flex gap-1 mt-3">
                          {rc.photos.slice(0, 3).map((url: string) => (
                            <img key={url} src={url} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded object-cover border" />
                          ))}
                          {rc.photos.length > 3 && (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              +{rc.photos.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Acciones: siempre visibles en táctil, al pasar el mouse en escritorio */}
                    {canWrite && (
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rc)} className="h-8 text-xs gap-1">
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendToOwner(rc)}
                        disabled={sendingId === rc.id}
                        className="h-8 text-xs gap-1 text-accent"
                      >
                        <Send className="h-3 w-3" /> {rc.is_sent ? "Reenviar" : "Enviar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(rc.id)}
                        aria-label={`Eliminar report card de ${rc.dog_name}`}
                        className="h-8 text-xs gap-1 text-destructive ml-auto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="tabular-nums">{page + 1} / {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!data?.hasMore} className="gap-1">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ReportCardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editData={editData}
        onSaved={invalidate}
      />
      <ReportCardDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        reportCard={detailData}
        staffName={staffName(detailData?.staff_members)}
        onEdit={() => { setDetailOpen(false); openEdit(detailData); }}
        onSend={() => handleSendToOwner(detailData)}
        sending={!!detailData && sendingId === detailData.id}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar report card?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer y se borra también del historial del perro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
