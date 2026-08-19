import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAge } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Phone, Mail, MapPin, User, Dog, Package,
  FileText, Edit, CreditCard, Calendar, AlertTriangle,
  CheckCircle2, Clock, Loader2, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerModal } from "@/components/customers/CustomerModal";
import type { DbCustomer } from "@/pages/CustomersPage";
import { formatCurrency } from "@/lib/currency";
import { getEffectivePackageStatus } from "@/lib/packageStatus";

interface DbDog {
  id: string;
  name: string;
  breed: string;
  gender: string;
  birth_date: string | null;
  weight: number | null;
  is_neutered: boolean;
  color: string | null;
}

interface DbReservation {
  id: string;
  service_name: string;
  service_type: string;
  status: string;
  start_date: string;
  end_date: string;
  total_price: number;
  dogs: { name: string } | null;
}

interface DbPackage {
  id: string;
  name: string;
  service_type: string;
  total_credits: number;
  remaining_credits: number;
  status: string;
  expires_at: string;
  price: number;
}

interface DbInvoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string;
  paid_at: string | null;
}

const statusColors: Record<string, string> = {
  requested: "bg-warning/10 text-warning",
  scheduled: "bg-primary/10 text-primary",
  checked_in: "bg-success/10 text-success",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  requested: "Solicitada",
  scheduled: "Programada",
  checked_in: "Check-in",
  in_progress: "En progreso",
  ready: "Lista",
  completed: "Completada",
  cancelled: "Cancelada",
};

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();

  const [customer, setCustomer] = useState<DbCustomer | null>(null);
  const [dogs, setDogs] = useState<DbDog[]>([]);
  const [reservations, setReservations] = useState<DbReservation[]>([]);
  const [packages, setPackages] = useState<DbPackage[]>([]);
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id || !organization) return;
    setLoading(true);

    const [custRes, dogsRes, reservRes, pkgRes, invRes] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).eq("organization_id", organization!.id).single(),
      supabase.from("dogs").select("*").eq("customer_id", id).eq("organization_id", organization!.id).order("name"),
      supabase
        .from("reservations")
        .select("id, service_name, service_type, status, start_date, end_date, total_price, dogs(name)")
        .eq("customer_id", id)
        .eq("organization_id", organization!.id)
        .order("start_date", { ascending: false })
        .limit(20),
      supabase
        .from("packages")
        .select("id, name, service_type, total_credits, remaining_credits, status, expires_at, price")
        .eq("customer_id", id)
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, invoice_number, total, status, due_date, paid_at")
        .eq("customer_id", id)
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (custRes.data) setCustomer(custRes.data as DbCustomer);
    if (dogsRes.data) setDogs(dogsRes.data);
    if (reservRes.data) setReservations(reservRes.data);
    if (pkgRes.data) setPackages(pkgRes.data);
    if (invRes.data) setInvoices(invRes.data);

    setLoading(false);
  }, [id, organization]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (data: Partial<DbCustomer>) => {
    const payload = {
      first_name: data.first_name!,
      last_name: data.last_name!,
      email: data.email!,
      phone: data.phone!,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      emergency_contact_name: data.emergency_contact_name || null,
      emergency_contact_phone: data.emergency_contact_phone || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("customers").update(payload).eq("id", id!);
    if (error) {
      toast.error("No se pudo guardar", { description: "Revisa tu conexión e inténtalo de nuevo." });
    } else {
      toast.success("Cliente actualizado");
      setEditModalOpen(false);
      fetchAll();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="outline" onClick={() => orgNavigate("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Clientes
        </Button>
      </div>
    );
  }

  const initials = `${customer.first_name[0]}${customer.last_name[0]}`.toUpperCase();
  const totalSpent = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);
  const activePackages = packages.filter((p) => p.status === "active");
  const pendingInvoices = invoices.filter((i) => i.status === "pending" || i.status === "overdue");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => orgNavigate("/customers")} className="-ml-2 no-print">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Clientes
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 text-xl">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {customer.first_name} {customer.last_name}
            </h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {customer.email}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {customer.phone}
              </span>
              {customer.city && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {customer.city}{customer.state ? `, ${customer.state}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={() => setEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Mascotas</p>
            <p className="text-3xl font-bold mt-1">{dogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Reservas</p>
            <p className="text-3xl font-bold mt-1">{reservations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Total gastado</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Balance</p>
            <p className={`text-3xl font-bold mt-1 ${customer.balance < 0 ? "text-destructive" : customer.balance > 0 ? "text-success" : ""}`}>
              {customer.balance < 0 ? "-" : ""}{formatCurrency(Math.abs(customer.balance))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dogs" className="print-all-tabs">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dogs" className="gap-2">
            <Dog className="h-4 w-4" />
            Mascotas ({dogs.length})
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <Calendar className="h-4 w-4" />
            Reservas ({reservations.length})
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <Package className="h-4 w-4" />
            Paquetes ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Facturas ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            Info
          </TabsTrigger>
        </TabsList>

        {/* Dogs Tab */}
        <TabsContent value="dogs" className="mt-4" forceMount>
          {dogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Dog className="h-10 w-10" />
              <p>Sin mascotas registradas</p>
              <Button size="sm" variant="outline" onClick={() => orgNavigate("/dogs")}>
                Registrar mascota
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dogs.map((dog) => (
                <Card key={dog.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-accent/20">
                          <Dog className="h-6 w-6 text-accent-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{dog.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{dog.breed}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Género</span>
                      <span>{dog.gender === "male" ? "♂ Macho" : "♀ Hembra"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Edad</span>
                      <span>{getAge(dog.birth_date)}</span>
                    </div>
                    {dog.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peso</span>
                        <span>{dog.weight} kg</span>
                      </div>
                    )}
                    {dog.is_neutered && (
                      <Badge variant="secondary" className="text-xs">
                        {dog.gender === "male" ? "Castrado" : "Esterilizada"}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="mt-4" forceMount>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Mascota</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Sin reservas
                    </TableCell>
                  </TableRow>
                ) : reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.dogs?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.service_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.start_date), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{formatCurrency(r.total_price)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {statusLabels[r.status] ?? r.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="mt-4" forceMount>
          {packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Package className="h-10 w-10" />
              <p>Sin paquetes registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {packages.map((pkg) => {
                const pct = Math.round((pkg.remaining_credits / pkg.total_credits) * 100);
                const effectiveStatus = getEffectivePackageStatus(pkg);
                const isActive = effectiveStatus === "active";
                return (
                  <Card key={pkg.id} className={isActive ? "" : "opacity-60"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{pkg.name}</CardTitle>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "Activo" : effectiveStatus === "expired" ? "Vencido" : "Agotado"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Créditos</span>
                        <span className="font-medium">
                          {pkg.remaining_credits} / {pkg.total_credits}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Vence: {format(new Date(pkg.expires_at), "d MMM yyyy", { locale: es })}</span>
                        <span>{formatCurrency(pkg.price)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4" forceMount>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Factura</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Sin facturas
                    </TableCell>
                  </TableRow>
                ) : invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inv.due_date), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(inv.total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {inv.status === "paid" ? (
                          <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-success">Pagada</span></>
                        ) : inv.status === "overdue" ? (
                          <><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-destructive">Vencida</span></>
                        ) : inv.status === "pending" ? (
                          <><Clock className="h-4 w-4 text-warning" /><span className="text-warning">Pendiente</span></>
                        ) : (
                          <span className="text-muted-foreground">{inv.status}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4" forceMount>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Información de contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{customer.email}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span>{customer.phone}</span>
                </div>
                {customer.address && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dirección</span>
                      <span className="text-right">{customer.address}</span>
                    </div>
                  </>
                )}
                {customer.city && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ciudad</span>
                      <span>{customer.city}{customer.state ? `, ${customer.state}` : ""}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {(customer.emergency_contact_name || customer.emergency_contact_phone) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Contacto de emergencia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {customer.emergency_contact_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre</span>
                      <span>{customer.emergency_contact_name}</span>
                    </div>
                  )}
                  {customer.emergency_contact_phone && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Teléfono</span>
                        <span>{customer.emergency_contact_phone}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {customer.notes && (
              <Card className="sm:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Notas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CustomerModal
        customer={customer}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSave}
      />
    </div>
  );
}
