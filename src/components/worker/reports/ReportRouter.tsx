import type { Specialty } from "@/lib/worker";
import { TrainerReportForm } from "./TrainerReportForm";
import { VetReportForm } from "./VetReportForm";
import { CleaningReportForm } from "./CleaningReportForm";
import { WelfareReportForm } from "./WelfareReportForm";
import { GroomerReportForm } from "./GroomerReportForm";

export interface ReportTarget {
  kind: "task" | "reservation";
  id: string;
  dogId: string | null;
  dogName: string | null;
  serviceType: string | null;
}

export interface ReportFormProps {
  target: ReportTarget;
  /** Resolved staff_member id of the logged-in worker. */
  staffId: string;
  onDone: () => void;
}

/** Picks the report form matching the worker's specialty. */
export function ReportRouter({
  specialty,
  ...props
}: ReportFormProps & { specialty: Specialty | null }) {
  switch (specialty) {
    case "trainer":
      return <TrainerReportForm {...props} />;
    case "vet":
      return <VetReportForm {...props} />;
    case "cleaning":
      return <CleaningReportForm {...props} />;
    case "welfare":
      return <WelfareReportForm {...props} />;
    case "groomer":
      return <GroomerReportForm {...props} />;
    default:
      // Fallback: generic checklist (cleaning) so any worker can still close.
      return <CleaningReportForm {...props} />;
  }
}
