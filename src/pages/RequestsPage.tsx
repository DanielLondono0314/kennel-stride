import { useState, useMemo, useEffect } from "react";
import { getPopulatedReservations, mockUsers, mockLocations, mockServices } from "@/data/mockData";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check, X, Dog, AlertTriangle, Search, Eye, Clock, MapPin,
  User, Phone, FileText, Calendar, Filter, CheckCircle, XCircle,
  UserPlus, ChevronRight, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const serviceTypeLabels: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "Guardería",
  [ServiceType.BOARD_AND_TRAIN]: "Internado",
  [ServiceType.TRAINING_SESSION]: "Sesión de Entrenamiento",
  [ServiceType.GROOMING]: "Grooming",
  [ServiceType.EVALUATION]: "Evaluación",
};

const serviceTypeIcons: Record<ServiceType, string> = {
  [ServiceType.DAYCARE]: "🐕",
  [ServiceType.BOARD_AND_TRAIN]: "🏠",
  [ServiceType.TRAINING_SESSION]: "🎓",
  [ServiceType.GROOMING]: "✂️",
  [ServiceType.EVALUATION]: "📋",
};

type RequestTab = "pending" | "approved" | "rejected";

interface ProcessedRequest extends Reservation {
  assignedTrainerId?: string;
  processedAt?: Date;
  rejectionReason?: string;
}

export default function RequestsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [activeTab, setActiveTab] = useState<RequestTab>("pending");

  // Mutable state
  const [pendingRequests, setPendingRequests] = useState<ProcessedRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ProcessedRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<ProcessedRequest[]>([]);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ProcessedRequest | null>(null);
  const [assignedTrainer, setAssignedTrainer] = useState("");
  const [assignedLocation, setAssignedLocation] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Staff from Supabase
  const [staffList, setStaffList] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([]);

  useEffect(() => {
    // Load initial requests
    const allReservations = getPopulatedReservations();
    const requested = allReservations.filter(r => r.status === ReservationStatus.REQUESTED);
    setPendingRequests(requested);

    // Fetch staff from DB
    supabase.from("staff_members").select("id, first_name, last_name, role").eq("is_active", true).then(({ data }) => {
      if (data) setStaffList(data);
    });
  }, []);

  // Trainers only
  const trainers = useMemo(() => {
    const dbTrainers = staffList.filter(s => s.role === "trainer" || s.role === "admin");
    const mockTrainers = mockUsers.filter(u => u.role === "trainer" || u.role === "admin").map(u => ({
      id: u.id, first_name: u.firstName, last_name: u.lastName, role: u.role,
    }));
    // Merge, preferring DB
    const ids = new Set(dbTrainers.map(t => t.id));
    return [...dbTrainers, ...mockTrainers.filter(t => !ids.has(t.id))];
  }, [staffList]);

  // Filtered requests based on active tab
  const currentList = activeTab === "pending" ? pendingRequests : activeTab === "approved" ? approvedRequests : rejectedRequests;

  const filteredRequests = useMemo(() => {
    let list = currentList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.dog?.name.toLowerCase().includes(q) ||
        r.customer?.firstName.toLowerCase().includes(q) ||
        r.customer?.lastName.toLowerCase().includes(q)
      );
    }
    if (serviceFilter !== "all") {
      list = list.filter(r => r.service?.type === serviceFilter);
    }
    return list;
  }, [currentList, searchQuery, serviceFilter]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRequests.map(r => r.id)));
  };

  const hasBlockingFlags = (r: ProcessedRequest) => {
    return r.dog?.flags.some(f => f.severity === FlagSeverity.CRITICAL);
  };

  // Open detail view
  const openDetail = (r: ProcessedRequest) => {
    setSelectedRequest(r);
    setDetailModalOpen(true);
  };

  // Open approve modal
  const openApprove = (r: ProcessedRequest) => {
    setSelectedRequest(r);
    setAssignedTrainer(r.staffId || "");
    setAssignedLocation(r.locationId || "");
    setApproveNotes("");
    setApproveModalOpen(true);
  };

  // Open reject dialog
  const openReject = (r: ProcessedRequest) => {
    setSelectedRequest(r);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  // Approve single
  const confirmApprove = () => {
    if (!selectedRequest) return;
    const updated: ProcessedRequest = {
      ...selectedRequest,
      status: ReservationStatus.SCHEDULED,
      staffId: assignedTrainer || selectedRequest.staffId,
      locationId: assignedLocation || selectedRequest.locationId,
      assignedTrainerId: assignedTrainer,
      processedAt: new Date(),
      employeeNotes: approveNotes || selectedRequest.employeeNotes,
    };
    setPendingRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
    setApprovedRequests(prev => [updated, ...prev]);
    setApproveModalOpen(false);
    setSelectedRequest(null);
    const trainerName = trainers.find(t => t.id === assignedTrainer);
    toast.success("Solicitud aprobada", {
      description: `${updated.dog?.name} — ${updated.service?.name}${trainerName ? ` · Asignado a ${trainerName.first_name} ${trainerName.last_name}` : ""}`,
    });
  };

  // Reject single
  const confirmReject = () => {
    if (!selectedRequest) return;
    const updated: ProcessedRequest = {
      ...selectedRequest,
      status: ReservationStatus.CANCELLED,
      rejectionReason: rejectionReason,
      processedAt: new Date(),
    };
    setPendingRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
    setRejectedRequests(prev => [updated, ...prev]);
    setRejectDialogOpen(false);
    setSelectedRequest(null);
    toast.info("Solicitud rechazada", {
      description: `${updated.dog?.name} — ${updated.service?.name}`,
    });
  };

  // Batch approve
  const batchApprove = () => {
    const ids = Array.from(selectedIds);
    const toApprove = pendingRequests.filter(r => ids.includes(r.id));
    const approved = toApprove.map(r => ({ ...r, status: ReservationStatus.SCHEDULED as ReservationStatus, processedAt: new Date() }));
    setPendingRequests(prev => prev.filter(r => !ids.includes(r.id)));
    setApprovedRequests(prev => [...approved, ...prev]);
    setSelectedIds(new Set());
    toast.success(`${ids.length} solicitud(es) aprobada(s)`, {
      description: "Las reservas han sido confirmadas.",
    });
  };

  // Batch reject
  const openBatchReject = () => { setRejectionReason(""); setBatchRejectOpen(true); };
  const confirmBatchReject = () => {
    const ids = Array.from(selectedIds);
    const toReject = pendingRequests.filter(r => ids.includes(r.id));
    const rejected = toReject.map(r => ({
      ...r,
      status: ReservationStatus.CANCELLED as ReservationStatus,
      rejectionReason,
      processedAt: new Date(),
    }));
    setPendingRequests(prev => prev.filter(r => !ids.includes(r.id)));
    setRejectedRequests(prev => [...rejected, ...prev]);
    setSelectedIds(new Set());
    setBatchRejectOpen(false);
    toast.info(`${ids.length} solicitud(es) rechazada(s)`);
  };

  const tabCounts = {
    pending: pendingRequests.length,
    approved: approvedRequests.length,
    rejected: rejectedRequests.length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes</h1>
          <p className="text-muted-foreground">Revisa, aprueba y asigna las solicitudes de reserva</p>
        </div>
        {activeTab === "pending" && selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} seleccionada(s)</span>
            <Button variant="outline" size="sm" onClick={openBatchReject}>
              <XCircle className="h-4 w-4 mr-2" />Rechazar
            </Button>
            <Button size="sm" onClick={batchApprove} className="bg-primary hover:bg-primary/90">
              <CheckCircle className="h-4 w-4 mr-2" />Aprobar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as RequestTab); setSelectedIds(new Set()); }}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Inbox className="h-4 w-4" />
            Pendientes
            {tabCounts.pending > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">{tabCounts.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas
            {tabCounts.approved > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">{tabCounts.approved}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas
            {tabCounts.rejected > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">{tabCounts.rejected}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar perro o dueño..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={serviceFilter} onValueChange={(v) => setServiceFilter(v as ServiceType | "all")}>
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
                {/* Dog info */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                    {selectedRequest.dog?.avatarUrl ? (
                      <AvatarImage src={selectedRequest.dog.avatarUrl} alt={selectedRequest.dog?.name} />
                    ) : (
                      <AvatarFallback className="bg-accent text-accent-foreground text-lg"><Dog className="h-8 w-8" /></AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{selectedRequest.dog?.name}</h3>
                      <Badge variant="outline">{selectedRequest.dog?.breed}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedRequest.customer?.phone}</span>
                    </div>
                    {selectedRequest.dog?.flags && selectedRequest.dog.flags.length > 0 && (
                      <div className="mt-2"><FlagIndicators flags={selectedRequest.dog.flags} /></div>
                    )}
                  </div>
                </div>

                {/* Service details */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{selectedRequest.service && serviceTypeIcons[selectedRequest.service.type]}</span>
                        <div>
                          <p className="font-medium">{selectedRequest.service?.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedRequest.service && serviceTypeLabels[selectedRequest.service.type]}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">${selectedRequest.totalPrice.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />{format(selectedRequest.startDate, "EEEE, d 'de' MMMM", { locale: es })}</p>
                      <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-muted-foreground" />{format(selectedRequest.startDate, "HH:mm")} - {format(selectedRequest.endDate, "HH:mm")}</p>
                      <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{selectedRequest.location?.name || "Sin asignar"}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Notes */}
                {selectedRequest.notes && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas del cliente</p>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </div>
                )}

                {/* Dog details */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Raza:</span> {selectedRequest.dog?.breed}</div>
                  <div><span className="text-muted-foreground">Peso:</span> {selectedRequest.dog?.weight} kg</div>
                  <div><span className="text-muted-foreground">Género:</span> {selectedRequest.dog?.gender === "male" ? "Macho" : "Hembra"}</div>
                </div>

                {/* Rejection reason if applicable */}
                {selectedRequest.rejectionReason && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive uppercase mb-1">Razón del rechazo</p>
                    <p className="text-sm">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
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

      {/* Approve + Assign Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" />Aprobar Solicitud</DialogTitle>
            <DialogDescription>
              Aprueba y asigna un entrenador a esta solicitud
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent text-accent-foreground"><Dog className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedRequest.dog?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.service && serviceTypeLabels[selectedRequest.service.type]} · ${selectedRequest.totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Asignar entrenador</Label>
                <Select value={assignedTrainer} onValueChange={setAssignedTrainer}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar entrenador..." /></SelectTrigger>
                  <SelectContent>
                    {trainers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" />Ubicación</Label>
                <Select value={assignedLocation} onValueChange={setAssignedLocation}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar ubicación..." /></SelectTrigger>
                  <SelectContent>
                    {mockLocations.filter(l => l.isActive).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} (Cap. {l.capacity})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas internas (opcional)</Label>
                <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Instrucciones para el entrenador..." rows={2} className="resize-none" />
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
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmApprove}>
              <CheckCircle className="h-4 w-4 mr-2" />Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject single dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest && `Rechazar solicitud de ${selectedRequest.dog?.name} (${selectedRequest.customer?.firstName} ${selectedRequest.customer?.lastName})`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-2">
            <Label>Razón del rechazo (opcional)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ej: Vacunas vencidas, horario no disponible..." rows={2} className="resize-none" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Rechazar solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch reject dialog */}
      <AlertDialog open={batchRejectOpen} onOpenChange={setBatchRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar {selectedIds.size} solicitud(es)?</AlertDialogTitle>
            <AlertDialogDescription>Las solicitudes seleccionadas serán rechazadas y los clientes notificados.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-2">
            <Label>Razón del rechazo (opcional)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Razón común para todas..." rows={2} className="resize-none" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Rechazar {selectedIds.size} solicitud(es)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderTable(requests: ProcessedRequest[], showCheckbox: boolean) {
    if (requests.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-muted flex items-center justify-center">
            {activeTab === "pending" ? <Inbox className="h-8 w-8 text-muted-foreground" /> :
             activeTab === "approved" ? <CheckCircle className="h-8 w-8 text-primary" /> :
             <XCircle className="h-8 w-8 text-muted-foreground" />}
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {activeTab === "pending" ? "Todo al día" : activeTab === "approved" ? "Sin aprobaciones aún" : "Sin rechazos"}
          </h2>
          <p className="text-muted-foreground">
            {activeTab === "pending" ? "No hay solicitudes pendientes por revisar" :
             activeTab === "approved" ? "Las solicitudes aprobadas aparecerán aquí" :
             "Las solicitudes rechazadas aparecerán aquí"}
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {showCheckbox && (
                <TableHead className="w-12">
                  <Checkbox checked={selectedIds.size === requests.length && requests.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead className="min-w-[200px]">Perro / Dueño</TableHead>
              <TableHead>Tipo de Servicio</TableHead>
              <TableHead>Fecha / Hora</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Alertas</TableHead>
              {activeTab === "approved" && <TableHead>Entrenador</TableHead>}
              {activeTab === "rejected" && <TableHead>Razón</TableHead>}
              <TableHead>Recibida</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id} className="group">
                {showCheckbox && (
                  <TableCell>
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelection(r.id)} />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow">
                      {r.dog?.avatarUrl ? (
                        <AvatarImage src={r.dog.avatarUrl} alt={r.dog?.name} />
                      ) : (
                        <AvatarFallback className="bg-accent text-accent-foreground"><Dog className="h-5 w-5" /></AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <p className="font-medium">{r.dog?.name}</p>
                      <p className="text-sm text-muted-foreground">{r.customer?.firstName} {r.customer?.lastName}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.service && serviceTypeIcons[r.service.type]}</span>
                    <div>
                      <p className="text-sm font-medium">{r.service && serviceTypeLabels[r.service.type]}</p>
                      <p className="text-xs text-muted-foreground">{r.service?.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{format(r.startDate, "EEE, d MMM", { locale: es })}</p>
                    <p className="text-muted-foreground">{format(r.startDate, "HH:mm")} - {format(r.endDate, "HH:mm")}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">${r.totalPrice.toFixed(2)}</span>
                </TableCell>
                <TableCell>
                  <FlagIndicators flags={r.dog?.flags || []} />
                </TableCell>
                {activeTab === "approved" && (
                  <TableCell>
                    {r.assignedTrainerId ? (
                      <span className="text-sm">{trainers.find(t => t.id === r.assignedTrainerId)?.first_name || "Asignado"}</span>
                    ) : r.staffId ? (
                      <span className="text-sm text-muted-foreground">{r.staff?.firstName || "—"}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {activeTab === "rejected" && (
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate max-w-[150px] block">{r.rejectionReason || "Sin razón"}</span>
                  </TableCell>
                )}
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(r.createdAt, { addSuffix: true, locale: es })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                      <Eye className="h-4 w-4 mr-1" />Ver
                    </Button>
                    {activeTab === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openReject(r)} className="text-destructive hover:text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                        {hasBlockingFlags(r) ? (
                          <Button size="sm" variant="outline" className="text-warning border-warning/50" onClick={() => openDetail(r)}>
                            <AlertTriangle className="h-4 w-4 mr-1" />Revisar
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => openApprove(r)}>
                            <Check className="h-4 w-4 mr-1" />Aprobar
                          </Button>
                        )}
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
  }
}
