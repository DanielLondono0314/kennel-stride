import { Link, Outlet } from "react-router-dom";
import { ChevronsUpDown, UserCircle } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { WorkerBottomNav } from "./WorkerBottomNav";
import { OrgSwitcher } from "@/components/navigation/OrgSwitcher";

export function WorkerLayout() {
  const { organization } = useOrganization();
  const base = useOrgBasePath();
  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Perfil arriba a la derecha: la barra inferior queda para el trabajo diario. */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-4">
          <OrgSwitcher className="-ml-2 flex min-w-0 items-center gap-1 px-2 py-1 hover:bg-muted">
            {(interactive) => (
              <>
                <span className="truncate text-sm font-semibold">{organization?.name}</span>
                {interactive && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
              </>
            )}
          </OrgSwitcher>
          <Link to={`${base}/worker/profile`} aria-label="Mi perfil" className="rounded-full p-1 text-muted-foreground hover:text-foreground">
            <UserCircle className="h-6 w-6" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4">
        <Outlet />
      </main>
      <WorkerBottomNav />
    </div>
  );
}
