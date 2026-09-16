import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  usePlatformAdminVercelStatus,
  usePlatformAdminSupabaseMetrics,
} from "@/hooks/queries/usePlatformAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

function deploymentVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "READY") return "default";
  if (state === "ERROR" || state === "CANCELED") return "destructive";
  return "secondary";
}

function VercelSection() {
  const { data, isLoading, isError, error, refetch } = usePlatformAdminVercelStatus();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Vercel — últimos deploys</CardTitle>
        <a
          href="https://vercel.com/daniellondono0314s-projects/kennel-stride"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Abrir dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </CardHeader>
      <CardContent>
        {isError ? (
          <QueryErrorState
            title="No se pudo consultar Vercel"
            description={(error as Error)?.message}
            onRetry={() => refetch()}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin deploys recientes.</p>
        ) : (
          <div className="space-y-2">
            {data.map((d) => (
              <div key={d.uid} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.commitMessage ?? d.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.target ?? "preview"} · {d.creatorUsername ?? "—"} ·{" "}
                    {formatDistanceToNow(new Date(d.created), { addSuffix: true, locale: es })}
                  </p>
                </div>
                <Badge variant={deploymentVariant(d.state)}>{d.state}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SupabaseSection() {
  const { data, isLoading, isError, error, refetch } = usePlatformAdminSupabaseMetrics();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Supabase — salud del proyecto</CardTitle>
        <a
          href="https://supabase.com/dashboard/project/jqnpqmkwcaxqrevfqmue"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Abrir dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <QueryErrorState
            title="No se pudo consultar Supabase"
            description={(error as Error)?.message}
            onRetry={() => refetch()}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {data?.project && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Proyecto:</span>
                <span className="font-medium">{data.project.name}</span>
                <Badge variant="outline">{data.project.region}</Badge>
                <Badge variant={data.project.status === "ACTIVE_HEALTHY" ? "default" : "destructive"}>
                  {data.project.status}
                </Badge>
                {data.project.database?.version && (
                  <span className="text-xs text-muted-foreground">Postgres {data.project.database.version}</span>
                )}
              </div>
            )}
            {data?.health && data.health.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {data.health.map((h) => (
                  <div key={h.name} className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">{h.name}</p>
                    <Badge variant={h.healthy ? "default" : "destructive"} className="mt-1 text-[10px]">
                      {h.healthy ? "OK" : "DOWN"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de health check.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlatformAdminInfraPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Infraestructura</h1>
        <p className="text-sm text-muted-foreground">
          Estado de deploys (Vercel) y salud del proyecto (Supabase). Errores en producción viven en Sentry — todavía no configurado.
        </p>
      </div>

      <VercelSection />
      <SupabaseSection />
    </div>
  );
}
