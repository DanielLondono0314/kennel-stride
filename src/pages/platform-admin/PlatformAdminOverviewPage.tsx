import { usePlatformAdminOverview } from "@/hooks/queries/usePlatformAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Building2, Users, PawPrint, UserCheck, Sparkles, XCircle } from "lucide-react";

const KPIS: Array<{
  key: "total_organizations" | "active_organizations" | "trialing_organizations" | "cancelled_organizations" | "new_organizations_30d" | "total_dogs" | "total_customers" | "total_staff";
  label: string;
  icon: typeof Building2;
}> = [
  { key: "total_organizations", label: "Organizaciones totales", icon: Building2 },
  { key: "active_organizations", label: "Suscripciones activas", icon: UserCheck },
  { key: "trialing_organizations", label: "En trial", icon: Sparkles },
  { key: "cancelled_organizations", label: "Canceladas / vencidas", icon: XCircle },
  { key: "new_organizations_30d", label: "Altas últimos 30 días", icon: Sparkles },
  { key: "total_dogs", label: "Perros registrados", icon: PawPrint },
  { key: "total_customers", label: "Clientes registrados", icon: Users },
  { key: "total_staff", label: "Staff activo", icon: UserCheck },
];

export default function PlatformAdminOverviewPage() {
  const { data, isLoading, isError, refetch } = usePlatformAdminOverview();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Estado general de todas las organizaciones en KennelStride.</p>
      </div>

      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map(({ key, label, icon: Icon }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading || !data ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-semibold">{data[key]}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
