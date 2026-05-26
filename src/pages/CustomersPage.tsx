import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, MoreHorizontal, Phone, Mail, Dog, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { ImportDataModal } from "@/components/import/ImportDataModal";

export interface DbCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
  dog_count?: number;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<DbCustomer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchCustomers = async (reset = true) => {
    if (!organization) return;
    const currentPage = reset ? 0 : page;
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("customers")
      .select("*, dogs(id)")
      .eq("organization_id", organization!.id)
      .order("first_name")
      .range(from, to);

    if (!error && data) {
      const mapped = data.map((c: any) => ({
        ...c,
        dog_count: c.dogs?.length ?? 0,
      }));
      setCustomers((prev) => reset ? mapped : [...prev, ...mapped]);
      setHasMore(data.length === PAGE_SIZE);
      if (!reset) setPage(currentPage + 1);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { fetchCustomers(true); }, [organization?.id]);

  const filtered = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, searchQuery]);

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

    let error;
    if (data.id) {
      ({ error } = await supabase.from("customers").update(payload).eq("id", data.id));
    } else {
      ({ error } = await supabase.from("customers").insert({ ...payload, organization_id: organization!.id }));
    }

    if (error) {
      toast.error("Error al guardar cliente");
    } else {
      toast.success(data.id ? "Cliente actualizado" : "Cliente registrado");
      setModalOpen(false);
      fetchCustomers(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("customers").delete().eq("id", deleteId);
    if (error) {
      toast.error("Error al eliminar cliente");
    } else {
      toast.success("Cliente eliminado");
      fetchCustomers(true);
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestiona la información de tus clientes y sus mascotas</p>
        </div>
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto"
          onClick={() => { setEditingCustomer(null); setModalOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[200px]">Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Mascotas</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : filtered.map((customer) => {
              const initials = `${customer.first_name[0]}${customer.last_name[0]}`.toUpperCase();
              const hasBalance = customer.balance !== 0;
              const isOwing = customer.balance < 0;

              return (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => orgNavigate(`/customers/${customer.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {customer.first_name} {customer.last_name}
                        </p>
                        {customer.notes && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            {customer.notes.slice(0, 30)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {customer.email}
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dog className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{customer.dog_count ?? 0}</span>
                      <span className="text-sm text-muted-foreground">
                        {customer.dog_count === 1 ? "mascota" : "mascotas"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {hasBalance ? (
                      <span className={isOwing ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                        {isOwing ? "-" : "+"}${Math.abs(customer.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => orgNavigate(`/customers/${customer.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingCustomer(customer); setModalOpen(true); }}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(customer.id)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No se encontraron clientes</p>
        ) : filtered.map((customer) => {
          const initials = `${customer.first_name[0]}${customer.last_name[0]}`.toUpperCase();
          const hasBalance = customer.balance !== 0;
          const isOwing = customer.balance < 0;
          return (
            <Card
              key={customer.id}
              className="cursor-pointer"
              onClick={() => orgNavigate(`/customers/${customer.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {customer.first_name} {customer.last_name}
                      </p>
                      {customer.notes && (
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {customer.notes.slice(0, 30)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => orgNavigate(`/customers/${customer.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingCustomer(customer); setModalOpen(true); }}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(customer.id)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {customer.phone}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Dog className="h-4 w-4" />
                      <span className="font-medium text-foreground">{customer.dog_count ?? 0}</span>
                      <span>{customer.dog_count === 1 ? "mascota" : "mascotas"}</span>
                    </div>
                    {hasBalance ? (
                      <span className={isOwing ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                        {isOwing ? "-" : "+"}${Math.abs(customer.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasMore && !searchQuery && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchCustomers(false)} disabled={loadingMore}>
            {loadingMore ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      )}

      <CustomerModal
        customer={editingCustomer}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también sus perros, reservas y registros asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
