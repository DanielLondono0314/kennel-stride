import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchAll } from "@/lib/supabaseQuery";

export type KennelStatus = "available" | "occupied" | "maintenance";

export interface WorkerKennel {
  id: string;
  name: string;
  zoneId: string;
  status: KennelStatus;
  notes: string | null;
  dogId: string | null;
  dogName: string | null;
  dogPhotoUrl: string | null;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
  /** Ligada a una reserva con check-in: se libera con el check-out, no a mano. */
  reservationId: string | null;
  since: string | null;
}

export interface WorkerKennelZone {
  id: string;
  name: string;
  kennels: WorkerKennel[];
}

function keys(orgId: string | undefined) {
  return { all: ["worker-kennels", orgId] as const };
}

/** Perreras de la org agrupadas por zona, con el perro que ocupa cada una. */
export function useWorkerKennels() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: keys(orgId).all,
    enabled: !!orgId,
    queryFn: async (): Promise<WorkerKennelZone[]> => {
      const [zones, units] = await Promise.all([
        fetchAll((f, t) =>
          supabase
            .from("facility_zones")
            .select("id, name, sort_order, zone_type")
            .eq("organization_id", orgId!)
            .eq("zone_type", "kennels")
            .order("sort_order")
            .range(f, t)
        ),
        fetchAll((f, t) =>
          supabase
            .from("facility_units")
            .select("id, name, zone_id, status, notes, assigned_dog_id, assigned_dog_name, assigned_reservation_id, assignment_start, position_index")
            .eq("organization_id", orgId!)
            .order("position_index")
            .range(f, t)
        ),
      ]);

      const dogIds = [...new Set(units.map((u) => u.assigned_dog_id).filter(Boolean))] as string[];
      const dogs = dogIds.length
        ? (await supabase
            .from("dogs")
            .select("id, photo_url, is_aggressive, has_allergies, on_medication")
            .in("id", dogIds)).data ?? []
        : [];
      const dogById = new Map(dogs.map((d) => [d.id, d]));

      const byZone = new Map<string, WorkerKennel[]>();
      for (const u of units) {
        const dog = u.assigned_dog_id ? dogById.get(u.assigned_dog_id) : undefined;
        const kennel: WorkerKennel = {
          id: u.id,
          name: u.name,
          zoneId: u.zone_id,
          status: (u.status as KennelStatus) ?? "available",
          notes: u.notes?.trim() || null,
          dogId: u.assigned_dog_id,
          dogName: u.assigned_dog_name,
          dogPhotoUrl: dog?.photo_url ?? null,
          flags: { aggressive: !!dog?.is_aggressive, allergies: !!dog?.has_allergies, medication: !!dog?.on_medication },
          reservationId: u.assigned_reservation_id,
          since: u.assignment_start,
        };
        byZone.set(u.zone_id, [...(byZone.get(u.zone_id) ?? []), kennel]);
      }
      return zones
        .map((z) => ({ id: z.id, name: z.name, kennels: byZone.get(z.id) ?? [] }))
        .filter((z) => z.kennels.length > 0);
    },
  });
}

/** Cambios sobre perreras desde la app del trabajador. */
export function useKennelActions() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys(organization?.id).all });
    queryClient.invalidateQueries({ queryKey: ["worker-dogs", organization?.id] });
    queryClient.invalidateQueries({ queryKey: ["my-day"] });
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("facility_units")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: "available" | "maintenance"; notes?: string }) =>
      update(id, { status, ...(notes !== undefined ? { notes } : {}) }),
    onSuccess: invalidate,
  });

  const setNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => update(id, { notes }),
    onSuccess: invalidate,
  });

  /** Asignación manual (sin reserva). Un perro no puede estar en dos perreras. */
  const assign = useMutation({
    mutationFn: async ({ id, dogId, dogName }: { id: string; dogId: string; dogName: string }) => {
      const { data: other } = await supabase
        .from("facility_units")
        .select("name")
        .eq("organization_id", organization!.id)
        .eq("assigned_dog_id", dogId)
        .maybeSingle();
      if (other) throw new Error(`${dogName} ya está en ${other.name}. Muévelo desde esa perrera.`);
      await update(id, {
        status: "occupied",
        assigned_dog_id: dogId,
        assigned_dog_name: dogName,
        assignment_start: new Date().toISOString(),
        assignment_end: null,
        assigned_reservation_id: null,
      });
    },
    onSuccess: invalidate,
  });

  /** Solo perreras sin reserva: las de un check-in se liberan con el check-out. */
  const release = useMutation({
    mutationFn: (id: string) =>
      update(id, {
        status: "available",
        assigned_dog_id: null,
        assigned_dog_name: null,
        assignment_start: null,
        assignment_end: null,
        assigned_reservation_id: null,
      }),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      const { error } = await supabase.rpc("move_dog_kennel" as never, { p_from_unit: fromId, p_to_unit: toId } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { setStatus, setNotes, assign, release, move };
}
