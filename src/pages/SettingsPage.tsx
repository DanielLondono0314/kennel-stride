import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessProfileTab } from "@/components/settings/BusinessProfileTab";
import { StaffManagementTab } from "@/components/settings/StaffManagementTab";
import { UserProfileTab } from "@/components/settings/UserProfileTab";
import { Building2, Users, User } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra los ajustes de tu centro de adiestramiento</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Negocio
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Mi Perfil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <BusinessProfileTab />
        </TabsContent>
        <TabsContent value="staff" className="mt-6">
          <StaffManagementTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <UserProfileTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
