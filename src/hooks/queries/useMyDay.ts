import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { reservationBucket } from "@/lib/worker";

export interface FeedItem {
  kind: "reservation" | "task";
  id: string;
  title: string;
  dogName: string | null;
  dogId: string | null;
  dogPhotoUrl: string | null;
  kennelName: string | null;
  time: string | null;            // ISO
  bucket: "pending" | "in_progress" | "done";
  status: string;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
}

export function useMyDay() {
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();

  return useQuery({
    queryKey: ["my-day", organization?.id, staff?.id],
    enabled: !!organization?.id && !!staff?.id,
    queryFn: async (): Promise<FeedItem[]> => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { data: res, error } = await supabase
        .from("reservations")
        .select("id, service_name, status, start_date, dog_id, dogs(name, photo_url, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("staff_id", staff!.id)
        // Solapamiento con hoy: incluye estadías de varios días en curso.
        .lte("start_date", end.toISOString())
        .gte("end_date", start.toISOString())
        .order("start_date", { ascending: true });
      if (error) throw error;

      const reservationItems: FeedItem[] = (res ?? []).map((r: any): FeedItem => ({
        kind: "reservation",
        id: r.id,
        title: r.service_name,
        dogName: r.dogs?.name ?? null,
        dogId: r.dog_id,
        dogPhotoUrl: r.dogs?.photo_url ?? null,
        kennelName: null,
        time: r.start_date,
        bucket: reservationBucket(r.status),
        status: r.status,
        flags: {
          aggressive: !!r.dogs?.is_aggressive,
          allergies: !!r.dogs?.has_allergies,
          medication: !!r.dogs?.on_medication,
        },
      }));

      // Tareas del worker: las que vencen HOY, MÁS las abiertas sin fecha (un
      // scheduler puede asignar una tarea sin due_at) y las abiertas ATRASADAS de
      // días anteriores — antes desaparecían del día sin haberse hecho.
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, title, type, status, due_at, dog_id, dogs(name, photo_url, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("assignee_staff_id", staff!.id)
        .or(
          `and(due_at.gte.${start.toISOString()},due_at.lte.${end.toISOString()}),` +
            `and(due_at.is.null,status.in.(pending,in_progress)),` +
            `and(due_at.lt.${start.toISOString()},status.in.(pending,in_progress))`,
        );
      if (tErr) throw tErr;

      const taskItems: FeedItem[] = (tasks ?? []).map((t: any): FeedItem => ({
        kind: "task",
        id: t.id,
        title: t.title,
        dogName: t.dogs?.name ?? null,
        dogId: t.dog_id,
        dogPhotoUrl: t.dogs?.photo_url ?? null,
        kennelName: null,
        time: t.due_at,
        bucket: t.status === "in_progress" ? "in_progress" : t.status === "pending" ? "pending" : "done",
        status: t.status,
        flags: {
          aggressive: !!t.dogs?.is_aggressive,
          allergies: !!t.dogs?.has_allergies,
          medication: !!t.dogs?.on_medication,
        },
      }));

      // Perrera de cada perro, para saber a dónde ir sin abrir la tarea.
      const dogIds = [...new Set([...reservationItems, ...taskItems].map((i) => i.dogId).filter(Boolean))] as string[];
      if (dogIds.length > 0) {
        const { data: units } = await supabase
          .from("facility_units")
          .select("name, assigned_dog_id")
          .eq("organization_id", organization!.id)
          .in("assigned_dog_id", dogIds);
        const kennelByDog = new Map((units ?? []).map((u) => [u.assigned_dog_id as string, u.name as string]));
        for (const i of [...reservationItems, ...taskItems]) i.kennelName = i.dogId ? kennelByDog.get(i.dogId) ?? null : null;
      }

      return [...reservationItems, ...taskItems].sort((a, b) =>
        (a.time ?? "9").localeCompare(b.time ?? "9")
      );
    },
  });
}
