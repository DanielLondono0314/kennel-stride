import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useReservations } from "@/hooks/useReservations";
import { Reservation, ReservationStatus, ServiceType, FlagSeverity } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FlagIndicators } from "@/components/shared/FlagIndicators";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check, X, Dog, AlertTriangle, Search, Eye, Clock, MapPin,
  User, Phone, Calendar, Filter, CheckCircle, XCircle,
  UserPlus, Inbox, Loader2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";

const serviceTypeLabels: Record<string, string> = {
  daycare: "Guardería",
  board_and_train: "Internado",
  training_session: "Sesión de Entrenamiento",
  grooming: "Grooming",
  evaluation: "Evaluación",
};

const serviceTypeIcons: Record<string, string> = {
  daycare: "🐕",
  board_and_train: "🏠",
  training_session: "🎓",
  grooming: "✂️",
  evaluation: "📋",
};

type RequestTab = "pending" | "approved" | "rejected";

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function RequestsPage() {
  const { organization } = useOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<RequestTab>("pending");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Reservation | null>(null);
  const [assignedTrainer, setAssignedTrainer] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const { reservations, loading, refetch } = useReservations({ autoRefresh: true });

  useEffect(() => {
    if (!organization) return;
    supabase
      .from("staff_members")
      .select("id, first_name, last_name, role")
      .eq("is_active", true)
      .eq("organization_id", organization!.id)
      .then(({ data }) => { if (data) setStaffList(data); });
  }, [organization?.id]);

  const trainers = useMemo(
    () => staffList.filter((s) => s.role === "trainer" || s.role === "admin"),
    [staffList]
  );

  // Split by status
  const pendingRequests = useMemo(
    () => reservations.filter((r) => r.status === ReservationStatus.REQUESTED),
    [reservations]
  );
  const approvedRequests = useMemo(
    () => reservations.filter((r) =>
      [ReservationStatus.SCHEDULED, ReservationStatus.CHECKED_IN,
       ReservationStatus.IN_PROGRESS, ReservationStatus.READY,
       ReservationStatus.COMPLETED].includes(r.status)
    ),
    [reservations]
  );
  const rejectedRequests = useMemo(
    () => reservations.filter((r) => r.status === ReservationStatus.CANCELLED),
    [reservations]
  );

  const currentList =
    activeTab === "pending" ? pendingRequests
    : activeTab === "approved" ? approvedRequests
    : rejectedRequests;

  const filteredRequests = useMemo(() => {
    let list = currentList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        r.dog?.name.toLowerCase().includes(q) ||
        r.customer?.firstName.toLowerCase().includes(q) ||
        r.customer?.lastName.toLowerCase().includes(q)
      );
    }
    if (serviceFilter !== "all") {
      list = list.filter((r) => r.service?.type === serviceFilter);
    }
    return list;
  }, [currentList, searchQuery, serviceFilter]);

  const hasBlockingFlags = (r: Reservation) =>
    r.dog?.flags.some((f) => f.severity === FlagSeverity.CRITICAL);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
  };

  const openDetail = (r: Reservation) => { setSelectedRequest(r); setDetailModalOpen(true); };
  const openApprove = (r: Reservation) => {
    setSelectedRequest(r);
    setAssignedTrainer(r.staff?.id || "");
    setApproveNotes("");
    setApproveModalOpen(true);
  };
  const openReject = (r: Reservation) => {
    setSelectedRequest(r);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "scheduled",
        staff_id: assignedTrainer || null,
        notes: approveNotes
          ? `${selectedRequest.notes ? selectedRequest.notes + "\n" : ""}[Notas internas]: ${approveNotes}`
          : selectedRequest.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedRequest.id);

    setSaving(false);
    if (error) {
      toast.error("Error al aprobar");
    } else {
      const trainerName = trainers.find((t) => t.id === assignedTrainer);
      toast.success("Solicitud aprobada", {
        description: `${selectedRequest.dog?.name} — ${selectedRequest.service?.name}${trainerName ? ` · ${trainerName.first_name} ${trainerName.last_name}` : ""}`,
      });
      setApproveModalOpen(false);
      setSelectedRequest(null);
      refetch();
    }
  };

  const confirmReject = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        rejection_reason: rejectionReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedRequest.id);

    setSaving(false);
    if (error) {
      toast.error("Error al rechazar");
    } else {
      toast.info("Solicitud rechazada", {
        description: `${selectedRequest.dog?.name} — ${selectedRequest.service?.name}`,
      });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      refetch();
    }
  };

  const batchApprove = async () => {
    const ids = Array.from(selectedIds);
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "scheduled", updated_at: new Date().toISOString() })
      .in("id", ids);
    setSaving(false);
    if (!error) {
      setSelectedIds(new Set());
      toast.success(`${ids.length} solicitud(es) aprobada(s)`);
      refetch();
    }
  };

  const confirmBatchReject = async () => {
    const ids = Array.from(selectedIds);
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled", rejection_reason: rejectionReason || null, updated_at: new Date().toISOString() })
      .in("id", ids);
    setSaving(false);
    if (!error) {
      setSelectedIds(new Set());
      setBatchRejectOpen(false);
      toast.info(`${ids.length} solicitud(es) rechazada(s)`);
      refetch();
    }
  };

  const renderTable = (list: Reservation[], isPending: boolean) => {
    if (loading) return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando solicitudes...
      </div>
    );
    if (list.length === 0) return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Inbox className="h-10 w-10" />
        <p className="font-medium">No hay solicitudes aquí</p>
      </div>
    );

    return (
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {isPending && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === list.length && list.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
              )}
              <TableHead>Perro / Dueño</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id} className={selectedIds.has(r.id) ? "bg-muted/20" : ""}>
                {isPending && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleSelection(r.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-accent/20 text-accent-foreground">
                        <Dog className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{r.dog?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.customer?.firstName} {r.customer?.lastName}
                      </p>
                    </div>
                    {r.dog && r.dog.flags.length > 0 && (
                      <FlagIndicators flags={r.dog.flags} />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span>{r.service && serviceTypeIcons[r.service.type]}</span>
                    <span className="text-sm">{r.service?.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{format(r.startDate, "d MMM", { locale: es })}</p>
                    <p className="text-muted-foreground">
                      {format(r.startDate, "HH:mm")} – {format(r.endDate, "HH:mm")}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">${r.totalPrice.toFixed(2)}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    {isPending && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openReject(r)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => openApprove(r)}>
                          <Check className="h-4 w-4 mr-1" />
                          Aprobar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes</h1>
          <p className="text-muted-foreground">Revisa, aprueba y asigna las solicitudes de reserva</p>
        </div>
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto"
          onClick={() => setNewReservationOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nueva reserva</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
        {activeTab === "pending" && selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">
              {selectedIds.size} seleccionada(s)
            </span>
            <Button variant="outline" size="sm" onClick={() => { setRejectionReason(""); setBatchRejectOpen(true); }}>
              <XCircle className="h-4 w-4 mr-2" />Rechazar
            </Button>
            <Button size="sm" onClick={batchApprove} disabled={saving} className="bg-primary hover:bg-primary/90">
              <CheckCircle className="h-4 w-4 mr-2" />Aprobar
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as RequestTab); setSelectedIds(new Set()); }}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Inbox className="h-4 w-4" />
            Pendientes
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas
            {approvedRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {approvedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas
            {rejectedRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {rejectedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar perro o dueño..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo de servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los servicios</SelectItem>
              {Object.entries(serviceTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="pending" className="mt-4">
          {renderTable(filteredRequests, true)}
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          {renderTable(filteredRequests, false)}
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          {renderTable(filteredRequests, false)}
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Detalle de Solicitud
                </DialogTitle>
                <DialogDescription>
                  Solicitud de {selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                    <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                      <Dog className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{selectedRequest.dog?.name}</h3>
                      <Badge variant="outline">{selectedRequest.dog?.breed}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {selectedRequest.customer?.phone}
                      </span>
                    </div>
                    {selectedRequest.dog && selectedRequest.dog.flags.length > 0 && (
                      <div className="mt-2">
                        <FlagIndicators flags={selectedRequest.dog.flags} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {selectedRequest.service && serviceTypeIcons[selectedRequest.service.type]}
                        </span>
                        <div>
                          <p className="font-medium">{selectedRequest.service?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedRequest.service && serviceTypeLabels[selectedRequest.service.type]}
                          </p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">${selectedRequest.totalPrice.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <p className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(selectedRequest.startDate, "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(selectedRequest.startDate, "HH:mm")} – {format(selectedRequest.endDate, "HH:mm")}
                      </p>
                      {selectedRequest.staff && (
                        <p className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {selectedRequest.staff.firstName} {selectedRequest.staff.lastName}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {selectedRequest.notes && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas del cliente</p>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Raza:</span> {selectedRequest.dog?.breed}</div>
                  <div><span className="text-muted-foreground">Peso:</span> {selectedRequest.dog?.weight} kg</div>
                  <div>
                    <span className="text-muted-foreground">Género:</span>{" "}
                    {selectedRequest.dog?.gender === "male" ? "Macho" : "Hembra"}
                  </div>
                </div>

                <div>
                  <StatusBadge status={selectedRequest.status} />
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDistanceToNow(selectedRequest.startDate, { addSuffix: true, locale: es })}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>Cerrar</Button>
                {selectedRequest.status === ReservationStatus.REQUESTED && (
                  <>
                    <Button variant="outline" onClick={() => { setDetailModalOpen(false); openReject(selectedRequest); }}>
                      <X className="h-4 w-4 mr-2" />Rechazar
                    </Button>
                    <Button onClick={() => { setDetailModalOpen(false); openApprove(selectedRequest); }}>
                      <Check className="h-4 w-4 mr-2" />Aprobar y Asignar
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Aprobar Solicitud
            </DialogTitle>
            <DialogDescription>Aprueba y asigna un entrenador a esta solicitud</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    <Dog className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedRequest.dog?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.service?.name} · ${selectedRequest.totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Asignar entrenador
                </Label>
                <Select value={assignedTrainer} onValueChange={setAssignedTrainer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar entrenador..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas internas (opcional)</Label>
                <Textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Instrucciones para el entrenador..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {hasBlockingFlags(selectedRequest) && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Este perro tiene alertas críticas. Revisa antes de aprobar.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmApprove} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmar aprobación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rechazar Solicitud
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.dog?.name} – {selectedRequest?.service?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Razón del rechazo (opcional)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explica por qué se rechaza la solicitud..."
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewReservationModal
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        onSaved={refetch}
      />

      {/* Batch Reject Dialog */}
      <Dialog open={batchRejectOpen} onOpenChange={setBatchRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar {selectedIds.size} solicitud(es)</DialogTitle>
            <DialogDescription>Esta acción es irreversible.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Razón (opcional)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Razón del rechazo..."
              rows={2}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchRejectOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBatchReject} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Rechazar todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
