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
import { useMyOrganizations } from "@/hooks/queries/useMyOrganizations";
import { locationLabel, ownedPrincipal, type MyOrganization } from "@/lib/myOrganizations";
import { SELECT_ORG_PATH } from "@/lib/orgNavigation";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  /** Contenido del disparador; recibe si es desplegable (para mostrar el chevron). */
  children: ReactNode | ((interactive: boolean) => ReactNode);
  className?: string;
  align?: "start" | "center" | "end";
}

export function OrgAvatar({ org, className }: { org: Pick<MyOrganization, "name" | "logoUrl">; className?: string }) {
  return org.logoUrl ? (
    <img src={org.logoUrl} alt="" className={cn("h-8 w-8 shrink-0 rounded-lg object-cover", className)} />
  ) : (
    <div
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary", className)}
      aria-hidden
    >
      {org.name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Cambio de centro/sede al estilo "cambiar de cuenta": cada centro con su
 * avatar, las sedes bajo su principal y, para el dueño, "Nueva sede". Solo es
 * desplegable si hay algo que elegir.
 */
export function OrgSwitcher({ children, className, align = "start" }: OrgSwitcherProps) {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: orgs = [] } = useMyOrganizations();

  const hasOthers = orgs.some((o) => o.slug !== orgSlug);
  const principal = ownedPrincipal(orgs);
  const interactive = hasOthers || !!principal;
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
      <DropdownMenuContent align={align} className="w-72">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Mis centros</DropdownMenuLabel>
        {orgs.map((o) => {
          const label = locationLabel(o, orgs);
          return (
            <DropdownMenuItem
              key={o.slug}
              onSelect={() => o.slug !== orgSlug && navigate(`/${o.slug}`)}
              className={cn("gap-3 py-2", o.parentOrgId && orgs.some((p) => p.id === o.parentOrgId) && "pl-6")}
            >
              <OrgAvatar org={o} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{o.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {label ? `${label} · ${o.roleName}` : o.roleName}
                </p>
              </div>
              {o.slug === orgSlug && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Centro actual" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {principal && (
          <DropdownMenuItem onSelect={() => navigate(`/${principal.slug}/settings?tab=sedes`)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva sede
          </DropdownMenuItem>
        )}
        {hasOthers && (
          <DropdownMenuItem onSelect={() => navigate(SELECT_ORG_PATH)} className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Ver todos mis centros
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
