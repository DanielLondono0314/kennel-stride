import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  FileText, Plus, Search, Loader2, MoreHorizontal, DollarSign,
  Clock, AlertTriangle, CheckCircle2, CreditCard, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  payment_method: string | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  draft: { label: "Borrador", variant: "outline", icon: FileText },
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
  paid: { label: "Pagada", variant: "default", icon: CheckCircle2 },
  overdue: { label: "Vencida", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelada", variant: "outline", icon: Trash2 },
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  package: "Paquete",
  invoice: "Factura",
  lemon_squeezy: "LemonSqueezy",
};

export default function InvoicesPage() {
  const { organization } = useOrganization();
  const [invoices, setInvoices] = useState<(InvoiceRow & { customer?: CustomerRow })[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<(InvoiceRow & { customer?: CustomerRow }) | null>(null);
  const [detailItems, setDetailItems] = useState<InvoiceItemRow[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    customer_id: "",
    due_date: format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0 }] as { description: string; quantity: number; unit_price: number }[],
  });

  const fetchData = async () => {
    if (!organization) return;
    setLoading(true);
    const [invRes, custRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("organization_id", organization!.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id, first_name, last_name, email").eq("organization_id", organization!.id),
    ]);
    const custs = (custRes.data || []) as CustomerRow[];
    setCustomers(custs);
    setInvoices(
      (invRes.data || []).map((inv: any) => ({
        ...inv,
        customer: custs.find((c) => c.id === inv.customer_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [organization?.id]);

  const openCreate = () => {
    setForm({
      customer_id: customers[0]?.id || "",
      due_date: format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
      notes: "",
      items: [{ description: "", quantity: 1, unit_price: 0 }],
    });
    setModalOpen(true);
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unit_price: 0 }] });
  };

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const updateItem = (idx: number, field: string, value: string | number) => {
    const items = [...form.items];
    (items[idx] as any)[field] = value;
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  const handleSave = async () => {
    if (!form.customer_id || form.items.every((it) => !it.description)) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    setSaving(true);

    const validItems = form.items.filter((it) => it.description);
    const total = validItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);

    const { data: inv, error } = await supabase.from("invoices").insert({
      customer_id: form.customer_id,
      subtotal: total,
      tax: 0,
      discount: 0,
      total,
      status: "pending",
      due_date: form.due_date,
      notes: form.notes,
      organization_id: organization!.id,
    }).select().single();

    if (error || !inv) {
      toast.error("Error al crear factura");
      setSaving(false);
      return;
    }

    // Insert items
    const itemsToInsert = validItems.map((it) => ({
      invoice_id: inv.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.quantity * it.unit_price,
      organization_id: organization!.id,
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
    if (itemsError) {
      toast.error("Error al guardar los items de la factura");
      setSaving(false);
      return;
    }

    toast.success("Factura creada");
    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const handleMarkPaid = async (inv: InvoiceRow, method: string) => {
    const { error } = await supabase.from("invoices").update({
      status: "paid",
      payment_method: method,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", inv.id);
    
    if (error) toast.error("Error al marcar como pagada");
    else {
      toast.success(`Factura marcada como pagada (${paymentMethodLabels[method] || method})`);
      fetchData();
    }
  };

  const handleCancel = async (inv: InvoiceRow) => {
    const { error } = await supabase.from("invoices").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", inv.id);
    
    if (error) toast.error("Error");
    else {
      toast.success("Factura cancelada");
      fetchData();
    }
  };

  const openDetail = async (inv: InvoiceRow & { customer?: CustomerRow }) => {
    setDetailInvoice(inv);
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
    setDetailItems((data || []) as InvoiceItemRow[]);
    setDetailOpen(true);
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.first_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.last_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPIs
  const totalPending = invoices.filter((i) => i.status === "pending" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-muted-foreground">Gestión de facturas y pagos</p>
        </div>
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">${totalPaid.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cobrado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">${totalPending.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Por Cobrar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{invoices.length}</p>
                <p className="text-xs text-muted-foreground">Total Facturas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="paid">Pagadas</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
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
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No hay facturas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const cfg = statusConfig[inv.status] || statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                      <TableCell>
                        <div className="font-medium">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "d MMM yyyy", { locale: es })}</div>
                      </TableCell>
                      <TableCell>{inv.customer?.first_name} {inv.customer?.last_name}</TableCell>
                      <TableCell className="font-bold">${Number(inv.total).toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(inv.due_date), "d MMM yyyy", { locale: es })}</TableCell>
                      <TableCell>
                        {inv.payment_method ? (
                          <Badge variant="outline">{paymentMethodLabels[inv.payment_method] || inv.payment_method}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(inv.status === "pending" || inv.status === "overdue") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleMarkPaid(inv, "cash")}>
                                <DollarSign className="h-4 w-4 mr-2" />Pago Efectivo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkPaid(inv, "card")}>
                                <CreditCard className="h-4 w-4 mr-2" />Pago Tarjeta
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(inv)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Cancelar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Nueva Factura
            </DialogTitle>
            <DialogDescription>Crea una nueva factura con líneas de detalle</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Líneas de Factura</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
              </div>
              <div className="overflow-x-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-end min-w-[400px]">
                  <div>
                    {idx === 0 && <Label className="text-xs">Descripción</Label>}
                    <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Servicio o producto" />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Cant.</Label>}
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Precio</Label>}
                    <Input type="number" min={0} step={0.01} value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              </div>
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">${subtotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales..." rows={2} />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Factura {detailInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>
              {detailInvoice?.customer?.first_name} {detailInvoice?.customer?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Estado</p>
                <Badge variant={statusConfig[detailInvoice?.status || "pending"]?.variant}>
                  {statusConfig[detailInvoice?.status || "pending"]?.label}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Vencimiento</p>
                <p className="font-medium">
                  {detailInvoice?.due_date && format(new Date(detailInvoice.due_date), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              {detailInvoice?.paid_at && (
                <div>
                  <p className="text-muted-foreground">Pagada</p>
                  <p className="font-medium">{format(new Date(detailInvoice.paid_at), "d MMM yyyy HH:mm", { locale: es })}</p>
                </div>
              )}
              {detailInvoice?.payment_method && (
                <div>
                  <p className="text-muted-foreground">Método</p>
                  <p className="font-medium">{paymentMethodLabels[detailInvoice.payment_method] || detailInvoice.payment_method}</p>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="font-medium text-sm">Detalle</p>
              {detailItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1">
                  <span>{item.description} <span className="text-muted-foreground">×{item.quantity}</span></span>
                  <span className="font-medium">${Number(item.total).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span>${Number(detailInvoice?.total || 0).toFixed(2)}</span>
              </div>
            </div>
            {detailInvoice?.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notas</p>
                <p>{detailInvoice.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
