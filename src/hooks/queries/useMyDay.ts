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
        .select("id, service_name, status, start_date, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("staff_id", staff!.id)
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: true });
      if (error) throw error;

      return (res ?? []).map((r: any): FeedItem => ({
        kind: "reservation",
        id: r.id,
        title: r.service_name,
        dogName: r.dogs?.name ?? null,
        dogId: r.dog_id,
        time: r.start_date,
        bucket: reservationBucket(r.status),
        status: r.status,
        flags: {
          aggressive: !!r.dogs?.is_aggressive,
          allergies: !!r.dogs?.has_allergies,
          medication: !!r.dogs?.on_medication,
        },
      }));
    },
  });
}
