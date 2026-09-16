import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePlatformAdminAuditLog } from "@/hooks/queries/usePlatformAdminData";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShieldCheck } from "lucide-react";

export default function PlatformAdminAuditLogPage() {
  const { data, isLoading, isError, refetch } = usePlatformAdminAuditLog();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">Últimas 200 acciones realizadas desde el panel de plataforma.</p>
      </div>

      {isError ? (
        <QueryErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={8} columns={4} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Sin actividad todavía" description="Las acciones del panel de plataforma aparecerán aquí." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(row.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell className="font-medium">{row.action}</TableCell>
                  <TableCell className="text-muted-foreground">{row.target_org_id ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {row.metadata ? JSON.stringify(row.metadata) : "—"}
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
