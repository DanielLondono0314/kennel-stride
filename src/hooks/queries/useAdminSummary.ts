import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabaseQuery";
import { useOrganization } from "@/contexts/OrganizationContext";
import { subDays } from "date-fns";

// Mismo criterio que get_inactive_customer_ids(): un perro se considera
// "activo" si tuvo una reserva en curso/completada en esta ventana.
const ACTIVE_WINDOW_DAYS = 90;

export function useAdminSummary() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["admin-summary", orgId],
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const cutoff = subDays(new Date(), ACTIVE_WINDOW_DAYS).toISOString();

      // Listas paginadas (PostgREST corta en 1000 filas) y tareas contadas en el
      // servidor: antes se descargaban todas las tareas históricas solo para
      // contarlas, y al pasar de 1000 el total quedaba mal.
      const [dogsData, customersR, staffR, tasksTotalR, tasksPendingR, recentRes] = await Promise.all([
        fetchAll((f, t) => supabase.from("dogs").select("id, name, customer_id, customers(first_name, last_name), preferred_unit_id, facility_units(name)").eq("organization_id", orgId!).order("id").range(f, t)),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
        supabase.from("staff_members").select("id, first_name, last_name, role, is_active").eq("organization_id", orgId!),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId!).in("status", ["pending", "in_progress"]),
        fetchAll((f, t) => supabase.from("reservations")
          .select("dog_id, staff_id")
          .eq("organization_id", orgId!)
          .in("status", ["completed", "checked_in", "in_progress", "scheduled"])
          .gte("start_date", cutoff)
          .order("id")
          .range(f, t)),
      ]);

      if (customersR.error) throw customersR.error;
      if (staffR.error) throw staffR.error;
      if (tasksTotalR.error) throw tasksTotalR.error;
      if (tasksPendingR.error) throw tasksPendingR.error;

      const activeDogIds = new Set(recentRes.map((r) => r.dog_id));
      const dogStaffByDog = new Map<string, string>();
      recentRes.forEach((r) => {
        if (r.dog_id && r.staff_id && !dogStaffByDog.has(r.dog_id)) dogStaffByDog.set(r.dog_id, r.staff_id);
      });

      const dogs = dogsData.map((d: any) => ({
        id: d.id as string,
        name: d.name as string,
        customerName: d.customers ? `${d.customers.first_name} ${d.customers.last_name}` : "—",
        kennelName: d.facility_units?.name ?? null,
        isActive: activeDogIds.has(d.id),
      }));

      const staff = (staffR.data ?? []) as { id: string; first_name: string; last_name: string; role: string; is_active: boolean }[];

      return {
        dogs,
        activeDogsCount: dogs.filter((d) => d.isActive).length,
        inactiveDogsCount: dogs.filter((d) => !d.isActive).length,
        totalCustomers: customersR.count ?? 0,
        staff,
        activeStaffCount: staff.filter((s) => s.is_active).length,
        totalTasks: tasksTotalR.count ?? 0,
        pendingTasksCount: tasksPendingR.count ?? 0,
      };
    },
  });
}
