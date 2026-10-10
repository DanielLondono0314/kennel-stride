import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePermission } from "@/hooks/usePermission";

/** Muestra la historia clínica solo a quien tiene "Ver historia clínica". */
export function ClinicalGate({ children }: { children: ReactNode }) {
  const canView = usePermission("clinical.view");
  if (!canView) {
    return <EmptyState icon={Lock} title="Sin acceso a la historia clínica" description="Tu rol no tiene el permiso de ver historia clínica." />;
  }
  return <>{children}</>;
}
