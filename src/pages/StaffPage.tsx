import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StaffManagementTab } from "@/components/settings/StaffManagementTab";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, GraduationCap, Shield } from "lucide-react";

interface StaffStats {
  total: number;
  active: number;
  trainers: number;
  admins: number;
}

export default function StaffPage() {
  const [stats, setStats] = useState<StaffStats>({ total: 0, active: 0, trainers: 0, admins: 0 });

  useEffect(() => {
    supabase.from("staff_members").select("role, is_active").then(({ data }) => {
      if (!data) return;
      setStats({
        total: data.length,
        active: data.filter((s) => s.is_active).length,
        trainers: data.filter((s) => s.role === "trainer").length,
        admins: data.filter((s) => s.role === "admin" || s.role === "manager").length,
      });
    });
  }, []);

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
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
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
              <p className="text-2xl font-bold">{stats.trainers}</p>
              <p className="text-xs text-muted-foreground">Entrenadores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary/10">
              <Shield className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.admins}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StaffManagementTab />
    </div>
  );
}
