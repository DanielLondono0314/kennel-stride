import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePlatformAdminOrgDetail } from "@/hooks/queries/usePlatformAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function PlatformAdminOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data, isLoading, isError, refetch } = usePlatformAdminOrgDetail(orgId);

  if (isError) return <QueryErrorState onRetry={() => refetch()} />;

  if (isLoading || !data) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { organization: org, staff, packages, counts } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/platform-admin/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver a organizaciones
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">/{org.slug} · alta {format(new Date(org.created_at), "d MMM yyyy", { locale: es })}</p>
        </div>
        <Badge variant={org.subscription_status === "active" ? "default" : org.subscription_status === "trialing" ? "secondary" : "destructive"}>
          {org.subscription_status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Perros</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{counts.dogs}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{counts.customers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Staff</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{counts.staff}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Staff</CardTitle></CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin miembros de staff.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.first_name} {s.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell>{s.role}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Paquetes / créditos</CardTitle></CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin paquetes registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paquete</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Créditos restantes</TableHead>
                  <TableHead>Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell>{p.remaining_credits} / {p.total_credits}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.expires_at), "d MMM yyyy", { locale: es })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
