import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Megaphone, Plus, Search, Loader2, MoreHorizontal, Send, Calendar,
  Mail, MessageSquare, Smartphone, Trash2, Edit, Eye, Users,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignRow {
  id: string;
  name: string;
  description: string;
  segment_type: string;
  segment_filters: any;
  message_template: string;
  channel: string;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string;
  stats_sent: number;
  stats_delivered: number;
  stats_opened: number;
  stats_clicked: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "outline" },
  scheduled: { label: "Programada", variant: "secondary" },
  sent: { label: "Enviada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const segmentLabels: Record<string, string> = {
  all: "Todos",
  new: "Nuevos",
  inactive: "Inactivos 30+ días",
  vip: "VIP",
  custom: "Personalizado",
};

const channelConfig: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: Smartphone },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
};

const defaultForm = {
  name: "",
  description: "",
  segment_type: "all",
  message_template: "",
  channel: "email",
  scheduled_at: "",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [detailCampaign, setDetailCampaign] = useState<CampaignRow | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data || []) as CampaignRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (c: CampaignRow) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      description: c.description,
      segment_type: c.segment_type,
      message_template: c.message_template,
      channel: c.channel,
      scheduled_at: c.scheduled_at ? format(new Date(c.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description,
      segment_type: form.segment_type,
      message_template: form.message_template,
      channel: form.channel,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status: form.scheduled_at ? "scheduled" : "draft",
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editId);
      if (error) toast.error("Error al actualizar");
      else toast.success("Campaña actualizada");
    } else {
      const { error } = await supabase.from("campaigns").insert(payload);
      if (error) toast.error("Error al crear campaña");
      else toast.success("Campaña creada");
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const handleSend = async (c: CampaignRow) => {
    setSending(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { campaignId: c.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Campaña enviada a ${data.sent} destinatarios`, {
          description: data.delivered < data.sent
            ? `${data.delivered} entregados, ${data.failed} fallidos`
            : "Todos los mensajes entregados",
        });
      } else {
        toast.error(data?.error || "Error al enviar campaña");
      }
    } catch (err: any) {
      toast.error("Error al enviar campaña", {
        description: err?.message || "Verifica que la Edge Function esté desplegada",
      });
    } finally {
      setSending(null);
      fetchData();
    }
  };

  const handleCancel = async (c: CampaignRow) => {
    const { error } = await supabase.from("campaigns").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", c.id);
    if (error) toast.error("Error");
    else {
      toast.success("Campaña cancelada");
      fetchData();
    }
  };

  const handleDelete = async (c: CampaignRow) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) toast.error("Error al eliminar");
    else {
      toast.success("Campaña eliminada");
      fetchData();
    }
  };

  const filtered = campaigns.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPIs
  const totalSent = campaigns.filter((c) => c.status === "sent").length;
  const avgOpen = totalSent > 0
    ? Math.round(campaigns.filter((c) => c.status === "sent").reduce((s, c) => s + (c.stats_sent > 0 ? (c.stats_opened / c.stats_sent) * 100 : 0), 0) / totalSent)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campañas</h1>
          <p className="text-muted-foreground">Marketing y comunicación segmentada</p>
        </div>
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Megaphone className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-muted-foreground">Total Campañas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><Send className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10"><Eye className="h-5 w-5 text-info" /></div>
              <div>
                <p className="text-2xl font-bold">{avgOpen}%</p>
                <p className="text-xs text-muted-foreground">Tasa Apertura Prom.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><Users className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{campaigns.reduce((s, c) => s + c.stats_sent, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campaña..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="scheduled">Programadas</SelectItem>
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No hay campañas</p>
              <p className="text-sm">Crea tu primera campaña de marketing</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const cfg = statusConfig[c.status] || statusConfig.draft;
                  const ChannelIcon = channelConfig[c.channel]?.icon || Mail;
                  const openRate = c.stats_sent > 0 ? Math.round((c.stats_opened / c.stats_sent) * 100) : 0;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetailCampaign(c)}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy", { locale: es })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{segmentLabels[c.segment_type] || c.segment_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {channelConfig[c.channel]?.label || c.channel}
                        </div>
                      </TableCell>
                      <TableCell>{c.stats_sent > 0 ? c.stats_sent : "—"}</TableCell>
                      <TableCell>{c.stats_sent > 0 ? `${openRate}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(c.status === "draft" || c.status === "scheduled") && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(c)}>
                                  <Edit className="h-4 w-4 mr-2" />Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSend(c)}
                                  disabled={sending === c.id}
                                >
                                  {sending === c.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4 mr-2" />
                                  )}
                                  {sending === c.id ? "Enviando..." : "Enviar Ahora"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCancel(c)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {(c.status === "sent" || c.status === "cancelled") && (
                              <DropdownMenuItem onClick={() => handleDelete(c)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              {editId ? "Editar Campaña" : "Nueva Campaña"}
            </DialogTitle>
            <DialogDescription>
              {editId ? "Modifica los detalles de la campaña" : "Configura y programa una campaña de marketing"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Promo Verano 2026" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={form.segment_type} onValueChange={(v) => setForm({ ...form, segment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    <SelectItem value="new">Clientes nuevos</SelectItem>
                    <SelectItem value="inactive">Inactivos 30+ días</SelectItem>
                    <SelectItem value="vip">VIP (mayor gasto)</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plantilla del Mensaje</Label>
              <Textarea
                value={form.message_template}
                onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                placeholder="Hola {nombre}, tenemos una oferta especial para {perro}..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">Variables: {"{nombre}"}, {"{perro}"}, {"{email}"}</p>
            </div>
            <div className="space-y-2">
              <Label>Programar Envío (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? "Guardar" : "Crear Campaña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailCampaign} onOpenChange={() => setDetailCampaign(null)}>
        <DialogContent className="max-w-lg">
          {detailCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>{detailCampaign.name}</DialogTitle>
                <DialogDescription>{detailCampaign.description || "Sin descripción"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Segmento</p>
                    <p className="font-medium">{segmentLabels[detailCampaign.segment_type]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Canal</p>
                    <p className="font-medium">{channelConfig[detailCampaign.channel]?.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <Badge variant={statusConfig[detailCampaign.status]?.variant}>{statusConfig[detailCampaign.status]?.label}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha Envío</p>
                    <p className="font-medium">{detailCampaign.sent_at ? format(new Date(detailCampaign.sent_at), "d MMM yyyy HH:mm", { locale: es }) : "—"}</p>
                  </div>
                </div>
                {detailCampaign.status === "sent" && (
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="card-kpi">
                      <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold">{detailCampaign.stats_sent}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </CardContent>
                    </Card>
                    <Card className="card-kpi">
                      <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold">{detailCampaign.stats_delivered}</p>
                        <p className="text-xs text-muted-foreground">Entregados</p>
                      </CardContent>
                    </Card>
                    <Card className="card-kpi">
                      <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold">{detailCampaign.stats_opened}</p>
                        <p className="text-xs text-muted-foreground">Abiertos</p>
                      </CardContent>
                    </Card>
                    <Card className="card-kpi">
                      <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold">{detailCampaign.stats_clicked}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {detailCampaign.message_template && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mensaje</p>
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">{detailCampaign.message_template}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
