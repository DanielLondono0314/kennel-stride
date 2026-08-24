import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessProfileTab } from "@/components/settings/BusinessProfileTab";
import { StaffManagementTab } from "@/components/settings/StaffManagementTab";
import { UserProfileTab } from "@/components/settings/UserProfileTab";
import { InviteMembersTab } from "@/components/settings/InviteMembersTab";
import { TaskChecklistsTab } from "@/components/settings/TaskChecklistsTab";
import { Building2, Users, User, Users2, ClipboardCheck } from "lucide-react";

const VALID_TABS = ["business", "staff", "team", "tasks", "profile"] as const;
type SettingsTab = typeof VALID_TABS[number];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: SettingsTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as SettingsTab)
    : "business";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sync URL → state when ?tab= changes (e.g. user clicks header menu item)
  useEffect(() => {
    if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam as SettingsTab);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as SettingsTab);
    setSearchParams({ tab: value }, { replace: true });
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra los ajustes de tu centro de adiestramiento</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Negocio</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            <span className="hidden sm:inline">Equipo</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Tareas</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Mi Perfil</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <BusinessProfileTab />
        </TabsContent>
        <TabsContent value="staff" className="mt-6">
          <StaffManagementTab />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <InviteMembersTab />
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <TaskChecklistsTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <UserProfileTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
