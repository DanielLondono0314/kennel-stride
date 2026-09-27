import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { UpgradePrompt } from "@/components/shared/UpgradePrompt";
import type { Feature } from "@/lib/plans";

/**
 * Protege un módulo por plan. Si el plan de la org no lo incluye, muestra el
 * upsell dentro del layout (menú visible) en vez de la página. Es solo UX: el
 * backend hace cumplir el plan con RLS/triggers (ver migración membership_plans).
 */
export function FeatureRoute({ feature }: { feature: Feature }) {
  const { loading, hasFeature } = useOrganization();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasFeature(feature)) return <UpgradePrompt feature={feature} />;
  return <Outlet />;
}
