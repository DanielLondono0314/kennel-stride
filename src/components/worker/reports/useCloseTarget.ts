import { useCallback } from "react";
import { useUpdateTask } from "@/hooks/queries/useTasks";
import { useUpdateReservationStatus } from "@/hooks/queries/useReservationStatus";
import type { ReportTarget } from "./ReportRouter";

/**
 * Returns a function that closes a report target. For tasks it writes the full
 * completion patch (status/completed_at/completed_by + report_data/photos/notes).
 * For reservations it sets status='completed' (clinical/trainer data lives in its
 * own table, so the reservation itself only needs to be closed).
 */
export function useCloseTarget(target: ReportTarget, staffId: string) {
  const updateTask = useUpdateTask();
  const updateReservation = useUpdateReservationStatus();

  const closeTask = useCallback(
    async (patch: { report_data?: unknown; photos?: string[]; notes?: string }) => {
      await updateTask.mutateAsync({
        id: target.id,
        patch: {
          ...patch,
          status: "done",
          completed_at: new Date().toISOString(),
          completed_by: staffId,
        },
      });
    },
    [updateTask, target.id, staffId]
  );

  const closeReservation = useCallback(async () => {
    await updateReservation.mutateAsync({
      id: target.id,
      patch: { status: "completed" },
    });
  }, [updateReservation, target.id]);

  return {
    closeTask,
    closeReservation,
    isPending: updateTask.isPending || updateReservation.isPending,
  };
}
