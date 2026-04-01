import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Bell, HelpCircle, LogOut, User, Settings, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AppHeaderProps {
  noticeCount?: number;
  onMenuToggle?: () => void;
}

export function AppHeader({
  noticeCount = 0,
  onMenuToggle,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.first_name) {
          setProfileName(`${data.first_name} ${data.last_name}`.trim());
        }
      });
  }, [user?.id]);

  const displayName =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b bg-card gap-3">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="md:hidden shrink-0 text-muted-foreground" onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:w-96 lg:flex-none">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar clientes, perros, reservas..."
          className="pl-10 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground" onClick={() => navigate("/notices")}>
          <HelpCircle className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="relative text-muted-foreground" onClick={() => navigate("/notices")}>
          <Bell className="h-5 w-5" />
          {noticeCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1">
              {noticeCount > 9 ? '9+' : noticeCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-2 md:pr-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-sm">
                <span className="font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
