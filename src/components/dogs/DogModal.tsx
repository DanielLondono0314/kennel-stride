import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dog } from "@/types";
import { mockCustomers } from "@/data/mockData";
import { Dog as DogIcon, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface DogModalProps {
  dog?: Dog | null;
  preselectedCustomerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Dog>) => void;
}

export function DogModal({ dog, preselectedCustomerId, open, onOpenChange, onSave }: DogModalProps) {
  const isEditing = !!dog;

  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isNeutered, setIsNeutered] = useState(false);
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (dog) {
      setCustomerId(dog.customerId);
      setName(dog.name);
      setBreed(dog.breed);
      setBirthDate(dog.birthDate ? dog.birthDate.toISOString().split("T")[0] : "");
      setWeight(dog.weight?.toString() || "");
      setColor(dog.color || "");
      setGender(dog.gender);
      setIsNeutered(dog.isNeutered);
      setMicrochipNumber(dog.microchipNumber || "");
      setNotes(dog.notes || "");
      setBehaviorNotes(dog.behaviorNotes || "");
      setMedicalNotes(dog.medicalNotes || "");
    } else {
      setCustomerId(preselectedCustomerId || "");
      setName(""); setBreed(""); setBirthDate(""); setWeight("");
      setColor(""); setGender("male"); setIsNeutered(false);
      setMicrochipNumber(""); setNotes(""); setBehaviorNotes(""); setMedicalNotes("");
    }
  }, [dog, preselectedCustomerId, open]);

  const handleSubmit = async () => {
    if (!customerId || !name || !breed) {
      toast.error("Completa los campos requeridos");
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave({
      id: dog?.id,
      customerId,
      name,
      breed,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      color: color || undefined,
      gender,
      isNeutered,
      microchipNumber: microchipNumber || undefined,
      notes: notes || undefined,
      behaviorNotes: behaviorNotes || undefined,
      medicalNotes: medicalNotes || undefined,
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DogIcon className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Perro" : "Nuevo Perro"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? `Editar información de ${dog?.name}` : "Registrar una nueva mascota"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Owner */}
          <div className="space-y-2">
            <Label>Dueño *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar dueño" />
              </SelectTrigger>
              <SelectContent>
                {mockCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name & Breed */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del perro" />
            </div>
            <div className="space-y-2">
              <Label>Raza *</Label>
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Raza" />
            </div>
          </div>

          {/* Gender & Neutered */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Género</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">♂ Macho</SelectItem>
                  <SelectItem value="female">♀ Hembra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color del pelaje" />
            </div>
            <div className="space-y-2">
              <Label>Microchip</Label>
              <Input value={microchipNumber} onChange={(e) => setMicrochipNumber(e.target.value)} placeholder="Número de microchip" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isNeutered} onCheckedChange={setIsNeutered} />
            <Label>{gender === "male" ? "Castrado" : "Esterilizada"}</Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas generales</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre el perro..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Notas de comportamiento</Label>
            <Textarea value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} placeholder="Comportamiento, reactividad, sociabilidad..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Notas médicas</Label>
            <Textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Condiciones médicas, alergias, medicamentos..." rows={2} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Guardar cambios" : "Crear perro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
