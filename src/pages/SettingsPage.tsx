import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessProfileTab } from "@/components/settings/BusinessProfileTab";
import { StaffManagementTab } from "@/components/settings/StaffManagementTab";
import { UserProfileTab } from "@/components/settings/UserProfileTab";
import { InviteMembersTab } from "@/components/settings/InviteMembersTab";
import { Building2, Users, User, Users2 } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra los ajustes de tu centro de adiestramiento</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-xl grid-cols-4">
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
        <TabsContent value="profile" className="mt-6">
          <UserProfileTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
