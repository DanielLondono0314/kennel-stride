import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export type RouteType = "route_pickup" | "route_dropoff";

function routeKeys(orgId: string | undefined) {
  return {
    all: ["routes", orgId] as const,
    today: (type: RouteType) => ["routes", orgId, "today", type] as const,
    candidates: (type: RouteType) => ["routes", orgId, "candidates", type] as const,
    drivers: () => ["routes", orgId, "drivers"] as const,
  };
}

export interface CandidateReservation {
  id: string;
  service_name: string;
  start_date: string;
  customer_id: string;
  dog_id: string;
  dogs: { name: string } | null;
  customers: { first_name: string; last_name: string; address: string; address_lat: number | null; address_lng: number | null } | null;
}

/** Reservas de hoy que piden transporte y aún no están en ninguna ruta. */
export function useCandidateReservationsForRoute(routeType: RouteType) {
  const { organization } = useOrganization();
  const column = routeType === "route_pickup" ? "pickup_requested" : "dropoff_requested";

  return useQuery({
    queryKey: routeKeys(organization?.id).candidates(routeType),
    enabled: !!organization?.id,
    queryFn: async (): Promise<CandidateReservation[]> => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      // Recogida = el día que empieza la estadía; entrega = el día que termina
      // (antes ambas usaban start_date y los internados nunca salían en la
      // ruta de entrega de su último día).
      const dateColumn = routeType === "route_pickup" ? "start_date" : "end_date";

      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("id, service_name, start_date, customer_id, dog_id, dogs(name), customers(first_name, last_name, address, address_lat, address_lng)")
        .eq("organization_id", organization!.id)
        .eq(column, true)
        .not("status", "in", "(cancelled,rejected,requested)")
        .gte(dateColumn, start.toISOString())
        .lte(dateColumn, end.toISOString())
        .order(dateColumn, { ascending: true });
      if (error) throw error;

      const reservationIds = ((reservations as { id: string }[] | null) ?? []).map((r) => r.id);
      if (reservationIds.length === 0) return [];

      // Solo interesan las paradas de ESTAS reservas (antes se traían todas las
      // paradas históricas de la plataforma, y al pasar de 1000 filas la
      // deduplicación fallaba en silencio).
      const { data: existingStops, error: stopsErr } = await supabase
        .from("route_stops")
        .select("reservation_id, tasks!inner(type, organization_id)")
        .eq("tasks.type", routeType)
        .eq("tasks.organization_id", organization!.id)
        .in("reservation_id", reservationIds);
      if (stopsErr) throw stopsErr;

      const alreadyRouted = new Set((existingStops ?? []).map((s: any) => s.reservation_id));
      return ((reservations as any) ?? []).filter((r: CandidateReservation) => !alreadyRouted.has(r.id));
    },
  });
}

/** Staff con specialty='driver' activos, candidatos a chofer de la ruta. */
export function useDrivers() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: routeKeys(organization?.id).drivers(),
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, first_name, last_name")
        .eq("organization_id", organization!.id)
        .eq("specialty", "driver")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Rutas de hoy (tasks tipo route_pickup/route_dropoff) con sus paradas. */
export function useRoutesToday(routeType: RouteType) {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: routeKeys(organization?.id).today(routeType),
    enabled: !!organization?.id,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, title, status, due_at,
          staff_members:assignee_staff_id(id, first_name, last_name),
          route_stops(id, sequence, address_snapshot, status, eta_minutes,
                      notification_error, dogs(name), customers(first_name, last_name, phone))
        `)
        .eq("organization_id", organization!.id)
        .eq("type", routeType)
        .gte("due_at", start.toISOString())
        .lte("due_at", end.toISOString())
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
}

export function useCreateDailyRoute() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({
      routeType,
      assigneeStaffId,
      reservationIds,
    }: {
      routeType: RouteType;
      assigneeStaffId: string;
      reservationIds: string[];
    }) => {
      const { data, error } = await supabase.rpc("create_daily_route", {
        p_organization_id: organization!.id,
        p_route_type: routeType,
        p_assignee_staff_id: assigneeStaffId,
        p_reservation_ids: reservationIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys(organization?.id).all });
    },
  });
}
