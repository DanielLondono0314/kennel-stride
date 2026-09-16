import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePlatformAdminOrganizations } from "@/hooks/queries/usePlatformAdminData";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Building2 } from "lucide-react";

function subscriptionBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  return "destructive";
}

export default function PlatformAdminOrganizationsPage() {
  const { data, isLoading, isError, refetch } = usePlatformAdminOrganizations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((org) => org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Organizaciones</h1>
        <p className="text-sm text-muted-foreground">Todos los kennels dados de alta en KennelStride.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o slug..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Sin resultados" description="Ninguna organización coincide con la búsqueda." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organización</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Staff activo</TableHead>
                <TableHead>Perros</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Última reserva</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Link to={`/platform-admin/organizations/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{org.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subscriptionBadgeVariant(org.subscription_status)}>
                      {org.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{org.active_staff_count}</TableCell>
                  <TableCell>{org.dogs_count}</TableCell>
                  <TableCell>{org.customers_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {org.last_reservation_at ? format(new Date(org.last_reservation_at), "d MMM yyyy", { locale: es }) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(org.created_at), "d MMM yyyy", { locale: es })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
