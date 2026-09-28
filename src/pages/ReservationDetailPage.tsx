import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, CalendarDays, Clock, Dog, FileSignature, Home, LogIn, LogOut, Pencil, StickyNote, Truck, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { RESERVATION_SELECT, mapDbToReservation, type DbReservationRow } from "@/hooks/useReservations";
import { isUuid } from "@/lib/ids";
import { formatCurrency } from "@/lib/currency";
import { formatReservationRange } from "@/lib/reservationDates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Detalle de una reserva con enlaces a su perro, dueño, perrera y contratos
 * (QA E-25). Antes la reserva no tenía página propia: solo se podía ver
 * editándola desde el Calendario o Solicitudes.
 */
export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = useOrgBasePath();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const validId = isUuid(id);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reservation", orgId, id],
    enabled: !!orgId && validId,
    retry: false,
    queryFn: async () => {
      const [res, contracts] = await Promise.all([
        supabase.from("reservations").select(RESERVATION_SELECT).eq("id", id!).eq("organization_id", orgId!).maybeSingle(),
        supabase.from("contracts").select("id, title, status, signed_at").eq("reservation_id", id!).eq("organization_id", orgId!),
      ]);
      if (res.error) throw res.error;
      const row = res.data as unknown as (DbReservationRow & { pickup_requested?: boolean; dropoff_requested?: boolean }) | null;
      return {
        reservation: row ? mapDbToReservation(row) : null,
        pickup: !!row?.pickup_requested,
        dropoff: !!row?.dropoff_requested,
        contracts: contracts.data ?? [],
      };
    },
  });

  const back = (
    <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => navigate(-1)}>
      <ArrowLeft className="h-4 w-4" /> Volver
    </Button>
  );

  if (validId && (isLoading || !orgId)) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const r = data?.reservation;
  if (!validId || !r) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mb-3" />
          <p className="font-medium text-foreground">Reserva no encontrada</p>
          <p className="text-sm">Puede que se haya eliminado o que el enlace esté mal.</p>
        </div>
      </div>
    );
  }

  const customerName = r.customer ? `${r.customer.firstName} ${r.customer.lastName}`.trim() : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {back}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {r.service?.name ?? "Reserva"}{r.dog?.name ? ` · ${r.dog.name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">{formatReservationRange(r.startDate, r.endDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Perro y dueño</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Dog className="h-4 w-4 text-muted-foreground" aria-hidden />
              {r.dog ? (
                <Link to={`${base}/dogs/${r.dog.id}`} className="font-medium text-primary hover:underline">{r.dog.name}</Link>
              ) : "—"}
              {r.dog?.breed && <span className="text-muted-foreground">· {r.dog.breed}</span>}
            </p>
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              {r.customer && customerName ? (
                <Link to={`${base}/customers/${r.customer.id}`} className="font-medium text-primary hover:underline">{customerName}</Link>
              ) : "—"}
            </p>
            {r.customer?.phone && (
              <p className="text-muted-foreground pl-6">
                <a href={`tel:${r.customer.phone}`} className="hover:underline">{r.customer.phone}</a>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Estadía</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              {format(r.startDate, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Hasta el {format(r.endDate, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
            </p>
            <p className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" aria-hidden />
              {r.location ? (
                <Link to={`${base}/facility`} className="text-primary hover:underline">Perrera {r.location.name}</Link>
              ) : <span className="text-muted-foreground">Sin perrera asignada</span>}
            </p>
            {r.checkInTime && (
              <p className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-muted-foreground" aria-hidden />
                Check-in {format(r.checkInTime, "d MMM HH:mm", { locale: es })}
              </p>
            )}
            {r.checkOutTime && (
              <p className="flex items-center gap-2">
                <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
                Check-out {format(r.checkOutTime, "d MMM HH:mm", { locale: es })}
              </p>
            )}
            {(data!.pickup || data!.dropoff) && (
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
                {[data!.pickup && "Recogida", data!.dropoff && "Entrega"].filter(Boolean).join(" y ")} a domicilio
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Cobro</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-2xl font-bold">{formatCurrency(r.totalPrice)}</p>
            {r.customer && (
              <Link to={`${base}/customers/${r.customer.id}`} className="text-primary hover:underline">
                Ver facturas y saldo del cliente
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contratos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data!.contracts.length === 0 ? (
              <p className="text-muted-foreground">Sin contratos para esta reserva.</p>
            ) : (
              data!.contracts.map((c) => (
                <p key={c.id} className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <Link to={`${base}/contracts`} className="text-primary hover:underline">{c.title}</Link>
                  <Badge variant={c.signed_at ? "default" : "secondary"} className="text-xs">{c.signed_at ? "Firmado" : "Sin firmar"}</Badge>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {r.notes && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4" />Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{r.notes}</p></CardContent>
        </Card>
      )}

      <NewReservationModal
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["reservation", orgId, id] })}
        editData={{
          id: r.id,
          serviceType: r.service?.type ?? "daycare",
          serviceName: r.service?.name,
          startDate: r.startDate,
          endDate: r.endDate,
          totalPrice: r.totalPrice,
          notes: r.notes,
          status: r.status,
          dogName: r.dog?.name,
          customerName: customerName ?? undefined,
          pickupRequested: data!.pickup,
          dropoffRequested: data!.dropoff,
        }}
      />
    </div>
  );
}
