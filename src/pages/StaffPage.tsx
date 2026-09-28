import { useMemo } from "react";
import { useStaffList } from "@/hooks/queries/useStaffMembers";
import { StaffManagementTab } from "@/components/settings/StaffManagementTab";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, GraduationCap, Shield, Loader2 } from "lucide-react";

interface StaffStats {
  total: number;
  active: number;
  workers: number;
  admins: number;
}

export default function StaffPage() {
  const { data: staffList = [], isLoading: loadingStats } = useStaffList();
  const stats = useMemo<StaffStats>(() => ({
    total: staffList.length,
    active: staffList.filter((s) => s.is_active).length,
    workers: staffList.filter((s) => s.role === "worker").length,
    admins: staffList.filter((s) => s.role === "admin" || s.role === "manager").length,
  }), [staffList]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Personal</h1>
        <p className="text-muted-foreground">Gestiona los miembros del equipo y sus roles</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.total}</p>}
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.active}</p>}
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20">
              <GraduationCap className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.workers}</p>}
              <p className="text-xs text-muted-foreground">Trabajadores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary/10">
              <Shield className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div>
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <p className="text-2xl font-bold">{stats.admins}</p>}
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StaffManagementTab />
    </div>
  );
}
