import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { format, isWithinInterval } from "date-fns";

export interface ScheduleItem {
  kind: "reservation" | "task";
  id: string;
  title: string;
  dogName: string | null;
  dogId: string | null;
  time: string | null;    // ISO; null = tarea sin fecha
  dayKey: string | null;  // "yyyy-MM-dd" para agrupar por día; null = sin fecha
  status: string;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
}

/**
 * Horario del trabajador para un rango de fechas (su propia semana): mismas
 * dos queries que useMyDay (reservas por staff_id, tareas por
 * assignee_staff_id) pero parametrizadas por rango en vez de "hoy", sin
 * agrupar por bucket de estado — se agrupan por día para la agenda semanal.
 */
export function useMyWeekSchedule(weekStart: Date, weekEnd: Date) {
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();
  const startIso = weekStart.toISOString();
  const endIso = weekEnd.toISOString();
  const includesToday = isWithinInterval(new Date(), { start: weekStart, end: weekEnd });

  return useQuery({
    queryKey: ["my-week-schedule", organization?.id, staff?.id, startIso, endIso],
    enabled: !!organization?.id && !!staff?.id,
    queryFn: async (): Promise<ScheduleItem[]> => {
      const { data: res, error } = await supabase
        .from("reservations")
        .select("id, service_name, status, start_date, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("staff_id", staff!.id)
        .gte("start_date", startIso)
        .lte("start_date", endIso)
        .order("start_date", { ascending: true });
      if (error) throw error;

      const reservationItems: ScheduleItem[] = (res ?? []).map((r: any): ScheduleItem => ({
        kind: "reservation",
        id: r.id,
        title: r.service_name,
        dogName: r.dogs?.name ?? null,
        dogId: r.dog_id,
        time: r.start_date,
        dayKey: format(new Date(r.start_date), "yyyy-MM-dd"),
        status: r.status,
        flags: {
          aggressive: !!r.dogs?.is_aggressive,
          allergies: !!r.dogs?.has_allergies,
          medication: !!r.dogs?.on_medication,
        },
      }));

      // Tareas con fecha dentro de la semana, más (solo si la semana visible
      // incluye HOY) las sin fecha que sigan abiertas — igual que useMyDay,
      // para no atarlas a una semana pasada/futura arbitraria.
      const orFilter = includesToday
        ? `and(due_at.gte.${startIso},due_at.lte.${endIso}),and(due_at.is.null,status.in.(pending,in_progress))`
        : `and(due_at.gte.${startIso},due_at.lte.${endIso})`;

      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, title, type, status, due_at, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("assignee_staff_id", staff!.id)
        .or(orFilter);
      if (tErr) throw tErr;

      const taskItems: ScheduleItem[] = (tasks ?? []).map((t: any): ScheduleItem => ({
        kind: "task",
        id: t.id,
        title: t.title,
        dogName: t.dogs?.name ?? null,
        dogId: t.dog_id,
        time: t.due_at,
        dayKey: t.due_at ? format(new Date(t.due_at), "yyyy-MM-dd") : null,
        status: t.status,
        flags: {
          aggressive: !!t.dogs?.is_aggressive,
          allergies: !!t.dogs?.has_allergies,
          medication: !!t.dogs?.on_medication,
        },
      }));

      return [...reservationItems, ...taskItems].sort((a, b) =>
        (a.time ?? "").localeCompare(b.time ?? "")
      );
    },
  });
}
