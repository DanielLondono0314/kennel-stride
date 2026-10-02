import { roleCanSeePage, type OrgPage } from "@/lib/permissions";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon, Lock } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Feature } from "@/lib/plans";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppNavLinkProps {
  /** Sección del panel: se oculta si el rol no la tiene. */
  page?: OrgPage;
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  badge?: number;
  /** Módulo de plan: si la org no lo incluye, el link se muestra con candado (lleva al upsell). */
  feature?: Feature;
  onClick?: () => void;
}

export function AppNavLink({ to, icon: Icon, label, collapsed, badge, feature, page, onClick }: AppNavLinkProps) {
  const { hasFeature, currentRole } = useOrganization();
  const locked = feature !== undefined && !hasFeature(feature);
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
  // Sección que el rol no ve (Configuración → Roles → Secciones del menú).
  if (page && !roleCanSeePage(currentRole, page)) return null;

  const linkContent = (
    <RouterNavLink
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
        locked && "opacity-60"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {locked && <Lock className="h-3.5 w-3.5 shrink-0" aria-label="No incluido en tu plan" />}
          {!locked && badge !== undefined && badge > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium px-1.5">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </RouterNavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium px-1.5">
              {badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}
