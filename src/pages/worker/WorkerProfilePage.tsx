import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { SPECIALTY_LABELS } from "@/lib/worker";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function WorkerProfilePage() {
  const { data: staff } = useMyStaffMember();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Perfil</h1>
      {staff && (
        <div className="rounded-lg border p-4">
          <p className="font-medium">{staff.first_name} {staff.last_name}</p>
          <p className="text-sm text-muted-foreground">
            {staff.specialty ? SPECIALTY_LABELS[staff.specialty] : "Sin especialidad"}
          </p>
        </div>
      )}
      <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </Button>
    </div>
  );
}
