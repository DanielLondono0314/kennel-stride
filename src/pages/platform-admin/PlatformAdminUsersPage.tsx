import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePlatformAdminUsers } from "@/hooks/queries/usePlatformAdminData";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Users } from "lucide-react";

export default function PlatformAdminUsersPage() {
  const { data, isLoading, isError, refetch } = usePlatformAdminUsers();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((u) => (u.email ?? "").toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Todos los usuarios registrados en KennelStride, cross-tenant.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" description="Ningún usuario coincide con la búsqueda." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Organizaciones</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    {u.memberships.length === 0 ? (
                      <span className="text-muted-foreground">Sin organización</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.memberships.map((m) => (
                          <Link key={m.organization_id} to={`/platform-admin/organizations/${m.organization_id}`}>
                            <Badge variant="outline" className="text-xs">
                              {m.organizations?.name ?? m.organization_id} · {m.role}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "d MMM yyyy, HH:mm", { locale: es }) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(u.created_at), "d MMM yyyy", { locale: es })}
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
