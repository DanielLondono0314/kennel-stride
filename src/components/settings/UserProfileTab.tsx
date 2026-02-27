import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Save, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function UserProfileTab() {
  // Demo user since there's no auth yet
  const [firstName, setFirstName] = useState("Maria");
  const [lastName, setLastName] = useState("García");
  const [email, setEmail] = useState("admin@kennelops.com");
  const [phone, setPhone] = useState("+1 555-0100");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();

  const handleSaveProfile = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    toast.success("Perfil actualizado", { description: "Los cambios en tu perfil se han guardado." });
    setSaving(false);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error("Completa todos los campos de contraseña"); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden"); return;
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres"); return;
    }
    toast.success("Contraseña actualizada");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Mi Perfil
          </CardTitle>
          <CardDescription>Administra tu información personal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{firstName} {lastName}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => toast.info("Cambio de avatar (próximamente)")}>
                Cambiar foto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Cambiar Contraseña
          </CardTitle>
          <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contraseña actual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleChangePassword}>
              <KeyRound className="h-4 w-4 mr-2" />
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
