import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";

export interface MyRouteStop {
  id: string;
  sequence: number;
  address_snapshot: string;
  status: "pending" | "en_route" | "notified" | "arrived" | "completed" | "skipped";
  eta_minutes: number | null;
  notification_error: string | null;
  dogs: { name: string } | null;
  customers: { first_name: string; last_name: string; phone: string } | null;
}

export interface MyRoute {
  id: string;
  type: "route_pickup" | "route_dropoff";
  title: string;
  status: string;
  stops: MyRouteStop[];
}

function myRouteKey(orgId: string | undefined, staffId: string | undefined) {
  return ["my-route", orgId, staffId] as const;
}

/** La ruta de hoy asignada al chofer autenticado, con sus paradas ordenadas. */
export function useMyActiveRoute() {
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();

  return useQuery({
    queryKey: myRouteKey(organization?.id, staff?.id),
    enabled: !!organization?.id && !!staff?.id,
    queryFn: async (): Promise<MyRoute | null> => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { data: task, error } = await supabase
        .from("tasks")
        .select("id, type, title, status")
        .eq("organization_id", organization!.id)
        .eq("assignee_staff_id", staff!.id)
        .in("type", ["route_pickup", "route_dropoff"])
        .neq("status", "done")
        .gte("due_at", start.toISOString())
        .lte("due_at", end.toISOString())
        .order("due_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!task) return null;

      const { data: stops, error: stopsErr } = await supabase
        .from("route_stops")
        .select("id, sequence, address_snapshot, status, eta_minutes, notification_error, dogs(name), customers(first_name, last_name, phone)")
        .eq("task_id", task.id)
        .order("sequence", { ascending: true });
      if (stopsErr) throw stopsErr;

      return { ...task, stops: (stops as any) ?? [] } as MyRoute;
    },
    refetchInterval: 15_000,
  });
}

/** El chofer marca "Salí hacia aquí": RPC de estado + geolocalización puntual
 * + invocación de la Edge Function que calcula el ETA y envía la notificación. */
export function useDepartToStop() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();

  return useMutation({
    mutationFn: async (stopId: string) => {
      const { error: rpcError } = await supabase.rpc("mark_route_stop_departed", { p_stop_id: stopId });
      if (rpcError) throw rpcError;

      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000 }
        );
      });

      const { data, error } = await supabase.functions.invoke("notify-route-stop", {
        body: {
          stopId,
          originLat: position?.coords.latitude,
          originLng: position?.coords.longitude,
        },
      });
      if (error) throw error;
      return data as { success: boolean; etaMinutes?: number; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRouteKey(organization?.id, staff?.id) });
    },
  });
}

export function useCompleteRouteStop() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();

  return useMutation({
    mutationFn: async ({ stopId, skipReason }: { stopId: string; skipReason?: string }) => {
      const { error } = await supabase.rpc("complete_route_stop", {
        p_stop_id: stopId,
        p_skip_reason: skipReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRouteKey(organization?.id, staff?.id) });
    },
  });
}
