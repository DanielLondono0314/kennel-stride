import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, LayoutGrid, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyOrganizations } from "@/hooks/queries/useMyOrganizations";
import { SELECT_ORG_PATH } from "@/lib/orgNavigation";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  /** Contenido del disparador; recibe si es desplegable (para mostrar el chevron). */
  children: ReactNode | ((interactive: boolean) => ReactNode);
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Cambia de centro sin escribir la URL. Solo es desplegable si hay algo que
 * elegir: otro centro, o (para admins) la opción de crear una sede nueva.
 */
export function OrgSwitcher({ children, className, align = "start" }: OrgSwitcherProps) {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { isAdmin } = useOrganization();
  const { data: orgs = [] } = useMyOrganizations();

  const hasOthers = orgs.some((o) => o.slug !== orgSlug);
  const interactive = hasOthers || isAdmin;
  const content = typeof children === "function" ? children(interactive) : children;
  if (!interactive) return <div className={className}>{content}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
        aria-label="Cambiar de centro"
      >
        {content}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Mis centros</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.slug} onSelect={() => o.slug !== orgSlug && navigate(`/${o.slug}`)} className="gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{o.name}</p>
              <p className="truncate text-xs text-muted-foreground">{o.roleName}</p>
            </div>
            {o.slug === orgSlug && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Centro actual" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {hasOthers && (
          <DropdownMenuItem onSelect={() => navigate(SELECT_ORG_PATH)} className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Ver todos mis centros
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onSelect={() => navigate("/onboarding")} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear otro centro o sede
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
