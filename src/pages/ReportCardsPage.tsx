import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useReportCards, useCreateReportCard } from "@/hooks/queries/useReportCards";
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
import { Plus, Search, FileText, Send, Pencil, Trash2, Dog } from "lucide-react";
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
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

const SERVICE_LABELS: Record<string, string> = {
  daycare: "Guardería",
  board_and_train: "Internado",
  training_session: "Entrenamiento",
  grooming: "Grooming",
  evaluation: "Evaluación",
};

const SERVICE_ICONS: Record<string, string> = {
  daycare: "🐕",
  board_and_train: "🏠",
  training_session: "🎓",
  grooming: "✂️",
  evaluation: "📋",
};

export default function ReportCardsPage() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [page] = useState(0);
  const [trainers, setTrainers] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useReportCards({ page });
  // The hook returns cards with a limited select; the page needs full rows.
  // Cast to any[] — DB columns are present at runtime even if not in TS select.
  const reportCards = (data?.cards ?? []) as any[];

  useEffect(() => {
    if (!organization) return;
    supabase
      .from("staff_members")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .eq("organization_id", organization.id)
      .order("first_name")
      .then(({ data }) => { if (data) setTrainers(data); });
  }, [organization?.id]);

  function getTrainerName(id: string | null) {
    if (!id) return "Sin asignar";
    const t = trainers.find((tr) => tr.id === id);
    return t ? `${t.first_name} ${t.last_name}` : "—";
  }

  const filtered = useMemo(() => {
    return reportCards.filter((rc) => {
      if (search && !rc.dog_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTrainer !== "all" && rc.trainer_id !== filterTrainer) return false;
      if (filterService !== "all" && rc.service_type !== filterService) return false;
      if (filterStatus === "sent" && !rc.is_sent) return false;
      if (filterStatus === "draft" && rc.is_sent) return false;
      return true;
    });
  }, [reportCards, search, filterTrainer, filterService, filterStatus]);

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
      toast.error("Error eliminando report card");
    } else {
      toast.success("Report card eliminado");
      queryClient.invalidateQueries({ queryKey: ["report-cards", organization?.id] });
    }
    setDeleteId(null);
  }

  async function handleSendToOwner(rc: any) {
    const { error } = await supabase
      .from("report_cards")
      .update({ is_sent: true, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", rc.id);
    if (error) {
      toast.error("Error enviando report card");
    } else {
      toast.success(`Report card de ${rc.dog_name} enviado al dueño`);
      queryClient.invalidateQueries({ queryKey: ["report-cards", organization?.id] });
    }
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
            {reportCards.length} report cards · {reportCards.filter((r) => !r.is_sent).length} borradores
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Report Card
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre de perro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTrainer} onValueChange={setFilterTrainer}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Entrenador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los entrenadores</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Servicio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            {Object.entries(SERVICE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{SERVICE_ICONS[k]} {v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Dog className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No hay report cards</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search || filterTrainer !== "all" || filterService !== "all"
              ? "No se encontraron resultados con los filtros actuales."
              : "Crea el primer report card para registrar el progreso de un perro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((rc) => (
            <Card key={rc.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openDetail(rc)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">{SERVICE_ICONS[rc.service_type] || "🐕"}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{rc.dog_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(rc.session_date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={rc.is_sent ? "default" : "secondary"} className="text-xs">
                    {rc.is_sent ? "Enviado" : "Borrador"}
                  </Badge>
                </div>

                <StarRating value={rc.overall_score} readonly size="sm" />

                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{SERVICE_LABELS[rc.service_type] || rc.service_type}</span>
                  <span>·</span>
                  <span>{getTrainerName(rc.trainer_id)}</span>
                </div>

                {rc.notes && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{rc.notes}</p>
                )}

                {rc.photos?.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {rc.photos.slice(0, 3).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded object-cover border" />
                    ))}
                    {rc.photos.length > 3 && (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        +{rc.photos.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rc)} className="h-8 text-xs gap-1">
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  {!rc.is_sent && (
                    <Button variant="ghost" size="sm" onClick={() => handleSendToOwner(rc)} className="h-8 text-xs gap-1 text-accent">
                      <Send className="h-3 w-3" /> Enviar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(rc.id)} className="h-8 text-xs gap-1 text-destructive ml-auto">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <ReportCardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editData={editData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["report-cards", organization?.id] })}
      />
      <ReportCardDetail open={detailOpen} onOpenChange={setDetailOpen} reportCard={detailData} trainerName={detailData ? getTrainerName(detailData.trainer_id) : undefined} />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar report card?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
