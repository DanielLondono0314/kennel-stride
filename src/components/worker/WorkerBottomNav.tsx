import { NavLink } from "react-router-dom";
import { CalendarDays, Clock, Bell, Truck, Dog, LayoutGrid } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { useMyActiveRoute } from "@/hooks/queries/useMyRoute";

export function WorkerBottomNav() {
  const base = useOrgBasePath();
  const { data: staff } = useMyStaffMember();
  // La tab de ruta solo aparece para choferes con una ruta activa hoy — evita
  // un tab muerto para el resto del staff o para un chofer sin ruta asignada.
  const { data: activeRoute } = useMyActiveRoute();
  const showRouteTab = staff?.specialty === "driver" && !!activeRoute;
  // Perreras solo si el plan incluye instalaciones.
  const { hasFeature } = useOrganization();
  const showKennelsTab = hasFeature("facility");

  const items = [
    { to: `${base}/worker`, label: "Mi día", icon: CalendarDays, end: true },
    { to: `${base}/worker/dogs`, label: "Perros", icon: Dog, end: false },
    ...(showKennelsTab ? [{ to: `${base}/worker/kennels`, label: "Perreras", icon: LayoutGrid, end: false }] : []),
    { to: `${base}/worker/schedule`, label: "Horario", icon: Clock, end: false },
    ...(showRouteTab ? [{ to: `${base}/worker/route`, label: "Ruta", icon: Truck, end: false }] : []),
    { to: `${base}/worker/notices`, label: "Avisos", icon: Bell, end: false },
  ];
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-20 grid border-t bg-background`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`
          }>
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
