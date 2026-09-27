import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { FEATURE_LABELS, PLANS, minimumTierFor, type Feature } from "@/lib/plans";

/** Pantalla que reemplaza un módulo no incluido en el plan actual. */
export function UpgradePrompt({ feature }: { feature: Feature }) {
  const { planTier, isAdmin } = useOrganization();
  const required = PLANS[minimumTierFor(feature)];
  const current = PLANS[planTier];

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">{FEATURE_LABELS[feature]} no está en tu plan</h2>
        <p className="text-sm text-muted-foreground">
          Este módulo está disponible desde el plan <strong>{required.name}</strong>. Tu plan actual
          es <strong>{current.name}</strong>.
        </p>
        {isAdmin ? (
          <Button asChild>
            <Link to="/billing">Ver planes</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pide a un administrador de tu organización que mejore el plan.
          </p>
        )}
      </div>
    </div>
  );
}
