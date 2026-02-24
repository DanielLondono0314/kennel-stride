import { useState, useMemo } from "react";
import { mockCustomers, mockDogs, mockPackages } from "@/data/mockData";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, Phone, Mail, CreditCard, Dog } from "lucide-react";
import { Customer } from "@/types";
import { toast } from "sonner";

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerList, setCustomerList] = useState<Customer[]>(mockCustomers);

  const customers = useMemo(() => {
    return customerList.map((customer) => ({
      ...customer,
      dogs: mockDogs.filter((d) => d.customerId === customer.id),
      packages: mockPackages.filter((p) => p.customerId === customer.id),
    }));
  }, [customerList]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) => c.firstName.toLowerCase().includes(query) || c.lastName.toLowerCase().includes(query) || c.email.toLowerCase().includes(query) || c.phone.includes(query)
    );
  }, [customers, searchQuery]);

  const handleNewCustomer = () => { setEditingCustomer(null); setModalOpen(true); };
  const handleEditCustomer = (customer: Customer) => { setEditingCustomer(customer); setModalOpen(true); };
  const handleSave = (data: Partial<Customer>) => {
    if (data.id) {
      setCustomerList((prev) =>
        prev.map((c) => (c.id === data.id ? { ...c, ...data, updatedAt: new Date() } as Customer : c))
      );
    } else {
      const newCustomer: Customer = {
        id: `cust_${Date.now()}`,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        notes: data.notes,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCustomerList((prev) => [newCustomer, ...prev]);
    }
    setModalOpen(false);
    toast.success(data.id ? "Cliente actualizado" : "Cliente creado", { description: `${data.firstName} ${data.lastName} guardado correctamente.` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestiona la información de tus clientes y sus mascotas</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNewCustomer}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Buscar por nombre, email o teléfono..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[200px]">Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Mascotas</TableHead>
              <TableHead>Paquetes Activos</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => {
              const initials = `${customer.firstName[0]}${customer.lastName[0]}`;
              const hasBalance = customer.balance !== 0;
              const isOwing = customer.balance < 0;

              return (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                        {customer.notes && <Badge variant="secondary" className="text-[10px] mt-1">{customer.notes}</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{customer.email}</p>
                      <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{customer.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dog className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{customer.dogs.length}</span>
                      <span className="text-sm text-muted-foreground">{customer.dogs.map((d) => d.name).join(", ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.packages.length > 0 ? (
                      <Badge variant="secondary">{customer.packages.length} activo{customer.packages.length > 1 ? "s" : ""}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasBalance ? (
                      <span className={isOwing ? "text-destructive font-medium" : "text-success font-medium"}>
                        {isOwing ? "-" : "+"}${Math.abs(customer.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info("Perfil del cliente (próximamente)")}>Ver perfil</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Nueva reserva (próximamente)")}>Nueva reserva</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Facturas (próximamente)")}>Ver facturas</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CustomerModal customer={editingCustomer} open={modalOpen} onOpenChange={setModalOpen} onSave={handleSave} />
    </div>
  );
}
