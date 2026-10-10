import { UserProfileTab } from "@/components/settings/UserProfileTab";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SPECIALTY_LABELS } from "@/lib/worker";

/** Mi perfil: disponible para cualquier rol (la configuración del centro es solo de administradores). */
export default function ProfilePage() {
  const { data: staff } = useMyStaffMember();
  const { currentRole } = useOrganization();
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">
          {currentRole?.name ?? "Miembro"}
          {staff?.specialty ? ` · ${SPECIALTY_LABELS[staff.specialty]}` : ""}
        </p>
      </div>
      <UserProfileTab />
    </div>
  );
}
