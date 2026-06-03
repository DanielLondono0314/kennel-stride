import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePackages, useCreatePackage, useUpdatePackage, useDeductCredit } from "@/hooks/queries/usePackages";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Package, Plus, Search, CreditCard, Calendar, User, Loader2, MoreHorizontal,
  TrendingDown, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PackageRow {
  id: string;
  customer_id: string;
  name: string;
  service_type: string;
  total_credits: number;
  remaining_credits: number;
  price: number;
  purchase_date: string;
  expires_at: string;
  status: string;
  ls_order_id: string | null;
  ls_variant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

const serviceTypeLabels: Record<string, string> = {
  daycare: "Guardería",
  board_and_train: "Internado + Entrenamiento",
  training_session: "Sesión de Entrenamiento",
  grooming: "Estética",
  evaluation: "Evaluación",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Activo", variant: "default" },
  expired: { label: "Vencido", variant: "destructive" },
  depleted: { label: "Agotado", variant: "secondary" },
};

export default function PackagesPage() {
  const { organization } = useOrganization();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    service_type: "daycare",
    total_credits: 10,
    price: 0,
    expires_at: "",
    notes: "",
  });

  const { data: pkgData, isLoading, isError, refetch } = usePackages({ page: 0, search, status: statusFilter });
  const packages = pkgData?.packages ?? [];
  const { data: allCustomersData } = useQuery({
    queryKey: ["customers-for-form", organization?.id],
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone")
        .eq("organization_id", organization!.id)
        .order("first_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const customers = allCustomersData ?? [];

  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const deductCredit = useDeductCredit();

  const openCreate = () => {
    setEditingPkg(null);
    setForm({
      customer_id: customers[0]?.id || "",
      name: "",
      service_type: "daycare",
      total_credits: 10,
      price: 0,
      expires_at: format(new Date(Date.now() + 90 * 86400000), "yyyy-MM-dd"),
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (pkg: PackageRow) => {
    setEditingPkg(pkg);
    setForm({
      customer_id: pkg.customer_id,
      name: pkg.name,
      service_type: pkg.service_type,
      total_credits: pkg.total_credits,
      price: pkg.price,
      expires_at: pkg.expires_at,
      notes: pkg.notes || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.name) { toast.error("Completa los campos obligatorios"); return; }
    setSaving(true);
    try {
      if (editingPkg) {
        await updatePkg.mutateAsync({ id: editingPkg.id, ...form });
        toast.success("Paquete actualizado");
      } else {
        await createPkg.mutateAsync({ ...form, purchase_date: new Date().toISOString() });
        toast.success("Paquete creado");
      }
      setModalOpen(false);
      setEditingPkg(null);
    } catch {
      toast.error("Error al guardar paquete");
    } finally {
      setSaving(false);
    }
  };

  const handleDeductCredit = async (pkg: any) => {
    if (pkg.remaining_credits <= 0) { toast.error("No hay créditos disponibles"); return; }
    try {
      await deductCredit.mutateAsync({ packageId: pkg.id, reason: "ajuste manual" });
      toast.success(`Crédito descontado (${pkg.remaining_credits - 1} restantes)`);
    } catch {
      toast.error("Error al descontar crédito");
    }
  };

  // The hook returns packages with embedded customers relation (pkg.customers)
  // Filter client-side for customer name search
  const filteredPackages = packages.filter((p: any) => {
    const customerName = p.customers
      ? `${p.customers.first_name} ${p.customers.last_name}`.toLowerCase()
      : "";
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      customerName.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const activeCount = packages.filter((p: any) => p.status === "active").length;
  const totalCreditsRemaining = packages.filter((p: any) => p.status === "active").reduce((s: number, p: any) => s + p.remaining_credits, 0);
  const expiringCount = packages.filter((p: any) => {
    if (p.status !== "active") return false;
    const days = (new Date(p.expires_at).getTime() - Date.now()) / 86400000;
    return days <= 7 && days >= 0;
  }).length;
  const totalRevenue = packages.reduce((s: number, p: any) => s + Number(p.price), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paquetes</h1>
          <p className="text-muted-foreground">Gestión de paquetes de créditos y servicios</p>
        </div>
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Paquete
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <CreditCard className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCreditsRemaining}</p>
                <p className="text-xs text-muted-foreground">Créditos Disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiringCount}</p>
                <p className="text-xs text-muted-foreground">Por Vencer (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-kpi">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Ingresos Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
            <SelectItem value="depleted">Agotados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isError ? (
            <QueryErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={5} />
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No hay paquetes</p>
              <p className="text-sm">Crea un nuevo paquete para comenzar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paquete</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead className="text-center">Créditos</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg: any) => {
                  const daysLeft = Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / 86400000);
                  const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;
                  const cfg = statusConfig[pkg.status] || statusConfig.active;
                  // Support both embedded customers (from hook) and flat customer (from old shape)
                  const customerName = pkg.customers
                    ? `${pkg.customers.first_name} ${pkg.customers.last_name}`
                    : pkg.customer
                    ? `${pkg.customer.first_name} ${pkg.customer.last_name}`
                    : "—";

                  return (
                    <TableRow key={pkg.id}>
                      <TableCell>
                        <div className="font-medium">{pkg.name}</div>
                        {pkg.ls_order_id && (
                          <span className="text-xs text-muted-foreground">LemonSqueezy ✓</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{customerName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{serviceTypeLabels[pkg.service_type] || pkg.service_type}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold">{pkg.remaining_credits}</span>
                          <span className="text-muted-foreground">/ {pkg.total_credits}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className="bg-success h-1.5 rounded-full transition-all"
                            style={{ width: `${(pkg.remaining_credits / pkg.total_credits) * 100}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">${Number(pkg.price).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={isExpiringSoon ? "text-warning font-medium" : ""}>
                            {format(new Date(pkg.expires_at), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {isExpiringSoon && (
                          <span className="text-xs text-warning">{daysLeft}d restantes</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones del paquete">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(pkg)}>
                              Editar
                            </DropdownMenuItem>
                            {pkg.status === "active" && (
                              <DropdownMenuItem onClick={() => handleDeductCredit(pkg)}>
                                <TrendingDown className="h-4 w-4 mr-2" />
                                Descontar Crédito
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
              <Package className="h-5 w-5 text-primary" />
              {editingPkg ? "Editar Paquete" : "Nuevo Paquete"}
            </DialogTitle>
            <DialogDescription>
              {editingPkg ? "Modifica los detalles del paquete" : "Crea un nuevo paquete de créditos"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingPkg && (
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nombre del Paquete *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Paquete 10 Días Guardería"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Servicio</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(serviceTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total de Créditos</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.total_credits}
                  onChange={(e) => setForm({ ...form, total_credits: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingPkg ? "Guardar Cambios" : "Crear Paquete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
