import { NavLink } from "react-router-dom";
import { CalendarDays, Bell, User } from "lucide-react";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";

export function WorkerBottomNav() {
  const base = useOrgBasePath();
  const items = [
    { to: `${base}/worker`, label: "Mi día", icon: CalendarDays, end: true },
    { to: `${base}/worker/notices`, label: "Avisos", icon: Bell, end: false },
    { to: `${base}/worker/profile`, label: "Perfil", icon: User, end: false },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-background">
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
