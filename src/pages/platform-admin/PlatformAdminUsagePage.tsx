import { useMemo } from "react";
import { Link } from "react-router-dom";
import { subDays } from "date-fns";
import {
  usePlatformAdminUsers,
  usePlatformAdminOrganizations,
  usePlatformAdminCreditConsumption,
} from "@/hooks/queries/usePlatformAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, Calendar } from "lucide-react";

function countActiveSince(lastSignIns: Array<string | null>, days: number): number {
  const cutoff = subDays(new Date(), days).getTime();
  return lastSignIns.filter((d) => d && new Date(d).getTime() >= cutoff).length;
}

export default function PlatformAdminUsagePage() {
  const usersQuery = usePlatformAdminUsers();
  const orgsQuery = usePlatformAdminOrganizations();
  const creditsQuery = usePlatformAdminCreditConsumption(30);

  const activity = useMemo(() => {
    if (!usersQuery.data) return null;
    const lastSignIns = usersQuery.data.map((u) => u.last_sign_in_at);
    return {
      dau: countActiveSince(lastSignIns, 1),
      wau: countActiveSince(lastSignIns, 7),
      mau: countActiveSince(lastSignIns, 30),
      total: usersQuery.data.length,
    };
  }, [usersQuery.data]);

  const topByActivity = useMemo(() => {
    if (!orgsQuery.data) return [];
    return [...orgsQuery.data]
      .sort((a, b) => (b.dogs_count + b.customers_count + b.reservations_count) - (a.dogs_count + a.customers_count + a.reservations_count))
      .slice(0, 15);
  }, [orgsQuery.data]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Uso y consumo</h1>
        <p className="text-sm text-muted-foreground">Actividad de usuarios, créditos consumidos y uso aproximado por organización.</p>
      </div>

      {usersQuery.isError ? (
        <QueryErrorState onRetry={() => usersQuery.refetch()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">DAU (últimas 24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading || !activity ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{activity.dau}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">WAU (7 días)</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading || !activity ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{activity.wau}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">MAU (30 días)</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading || !activity ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-semibold">
                  {activity.mau} <span className="text-sm font-normal text-muted-foreground">/ {activity.total} totales</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créditos consumidos por organización (últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {creditsQuery.isError ? (
            <QueryErrorState onRetry={() => creditsQuery.refetch()} />
          ) : creditsQuery.isLoading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : !creditsQuery.data || creditsQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consumo de créditos en este período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organización</TableHead>
                  <TableHead>Créditos consumidos</TableHead>
                  <TableHead>Reservas con crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsQuery.data.map((row) => (
                  <TableRow key={row.organization_id}>
                    <TableCell>
                      <Link to={`/platform-admin/organizations/${row.organization_id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>{row.credits_consumed}</TableCell>
                    <TableCell className="text-muted-foreground">{row.deductions_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso aproximado por organización</CardTitle>
          <p className="text-sm text-muted-foreground">
            Conteo de filas por org — una aproximación de tamaño de cuenta, no el costo real de infraestructura de Supabase (que es a nivel de proyecto, no por tenant).
          </p>
        </CardHeader>
        <CardContent>
          {orgsQuery.isError ? (
            <QueryErrorState onRetry={() => orgsQuery.refetch()} />
          ) : orgsQuery.isLoading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organización</TableHead>
                  <TableHead>Perros</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Reservas</TableHead>
                  <TableHead>Campañas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topByActivity.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link to={`/platform-admin/organizations/${org.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>{org.dogs_count}</TableCell>
                    <TableCell>{org.customers_count}</TableCell>
                    <TableCell>{org.reservations_count}</TableCell>
                    <TableCell>{org.campaigns_count}</TableCell>
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
