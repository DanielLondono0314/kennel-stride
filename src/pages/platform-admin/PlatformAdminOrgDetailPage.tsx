import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  usePlatformAdminOrgDetail,
  useAdjustPackageCredits,
  useSetSubscriptionStatus,
  PlatformOrgDetail,
} from "@/hooks/queries/usePlatformAdminData";
import { usePlatformAdmin } from "@/contexts/PlatformAdminContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { getFunctionErrorMessage } from "@/lib/functionError";

function subscriptionVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  return "destructive";
}

function AdjustCreditsDialog({ pkg, orgId }: { pkg: PlatformOrgDetail["packages"][number]; orgId: string }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const mutation = useAdjustPackageCredits(orgId);

  const handleSubmit = async () => {
    const deltaNum = Number(delta);
    if (!Number.isInteger(deltaNum) || deltaNum === 0) {
      toast.error("Ingresa un ajuste distinto de cero (puede ser negativo)");
      return;
    }
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio");
      return;
    }
    try {
      await mutation.mutateAsync({ packageId: pkg.id, delta: deltaNum, reason: reason.trim() });
      toast.success("Créditos ajustados");
      setOpen(false);
      setDelta("0");
      setReason("");
    } catch (err) {
      toast.error(await getFunctionErrorMessage(err, "No se pudo ajustar el crédito"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Ajustar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar créditos — {pkg.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Restantes actuales: {pkg.remaining_credits} / {pkg.total_credits}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delta">Ajuste (+/-)</Label>
            <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. compensación por error de facturación" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionStatusDialog({ orgId, currentStatus }: { orgId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const mutation = useSetSubscriptionStatus(orgId);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio");
      return;
    }
    try {
      await mutation.mutateAsync({ status, reason: reason.trim() });
      toast.success("Estado de suscripción actualizado");
      setOpen(false);
      setReason("");
    } catch (err) {
      toast.error(await getFunctionErrorMessage(err, "No se pudo actualizar el estado"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setStatus(currentStatus); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Cambiar estado</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forzar estado de suscripción</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Uso exclusivo de soporte (ej. reactivar tras resolver un pago fallido en LemonSqueezy). No reemplaza el webhook normal.
          </p>
          <div className="space-y-1.5">
            <Label>Nuevo estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="trialing">trialing</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status-reason">Motivo</Label>
            <Textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. pago manual confirmado por email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformAdminOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data, isLoading, isError, refetch } = usePlatformAdminOrgDetail(orgId);
  const { canWrite } = usePlatformAdmin();

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
        <div className="flex items-center gap-2">
          <Badge variant={subscriptionVariant(org.subscription_status)}>{org.subscription_status}</Badge>
          {canWrite && <SubscriptionStatusDialog orgId={org.id} currentStatus={org.subscription_status} />}
        </div>
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
                  {canWrite && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell>{p.remaining_credits} / {p.total_credits}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.expires_at), "d MMM yyyy", { locale: es })}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <AdjustCreditsDialog pkg={p} orgId={org.id} />
                      </TableCell>
                    )}
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
