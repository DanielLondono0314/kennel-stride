import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dog as DogIcon, Loader2, Save, Camera, X, Check, ChevronsUpDown, AlertTriangle, Leaf, Pill } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DOG_BREEDS } from "@/lib/constants";
import {
  dogSchema, feedingSchema, aggressionDetailsSchema, allergyRowSchema, medicationRowSchema,
} from "@/lib/schemas";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FeedingFields } from "@/components/dogs/FeedingFields";
import { AggressionFields } from "@/components/dogs/AggressionFields";
import { AllergyList } from "@/components/dogs/AllergyList";
import { MedicationList } from "@/components/dogs/MedicationList";
import {
  emptyAggression, emptyFeeding,
  type AggressionForm, type FeedingForm, type AllergyRow, type MedicationRow,
} from "@/types/dogClinical";

interface DogModalProps {
  dog?: any | null;
  preselectedCustomerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void | Promise<void>;
}

export function DogModal({ dog, preselectedCustomerId, open, onOpenChange, onSave }: DogModalProps) {
  const isEditing = !!dog;
  const { organization } = useOrganization();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [breedOpen, setBreedOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [isNeutered, setIsNeutered] = useState(false);
  const [isAggressive, setIsAggressive] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [onMedication, setOnMedication] = useState(false);
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [aggression, setAggression] = useState<AggressionForm>(emptyAggression());
  const [feeding, setFeeding] = useState<FeedingForm>(emptyFeeding());
  const [allergies, setAllergies] = useState<AllergyRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  // Toggle pendiente de confirmación de descarte.
  const [pendingClear, setPendingClear] = useState<null | "aggressive" | "allergies" | "medication">(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organization) return;
    supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("organization_id", organization.id)
      .order("first_name")
      .then(({ data }) => {
        if (data) setCustomers(data);
      });
  }, [organization?.id]);

  // Cargar alergias/medicación al abrir en modo edición.
  useEffect(() => {
    if (!open || !dog?.id) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase;
      const [aRes, mRes] = await Promise.all([
        db.from("dog_allergies").select("*").eq("dog_id", dog.id),
        db.from("dog_medications").select("*").eq("dog_id", dog.id),
      ]);
      setAllergies(((aRes.data as Record<string, unknown>[]) ?? []).map((r) => ({
        allergen: (r.allergen as string) ?? "", type: (r.type as AllergyRow["type"]) ?? "",
        reaction: (r.reaction as string) ?? "", severity: (r.severity as AllergyRow["severity"]) ?? "",
      })));
      setMedications(((mRes.data as Record<string, unknown>[]) ?? []).map((r) => ({
        name: (r.name as string) ?? "", dose: (r.dose as string) ?? "", frequency: (r.frequency as string) ?? "",
        duration_days: (r.duration_days as number) ?? "", start_date: (r.start_date as string) ?? "",
        route: (r.route as MedicationRow["route"]) ?? "", with_food: !!r.with_food,
      })));
    })();
  }, [open, dog?.id]);

  useEffect(() => {
    if (dog) {
      setCustomerId(dog.customer_id);
      setName(dog.name);
      setBreed(dog.breed);
      setBirthDate(dog.birth_date || "");
      setWeight(dog.weight?.toString() || "");
      setColor(dog.color || "");
      setGender(dog.gender as "male" | "female");
      setIsNeutered(dog.is_neutered);
      setIsAggressive(dog.is_aggressive ?? false);
      setHasAllergies(dog.has_allergies ?? false);
      setOnMedication(dog.on_medication ?? false);
      setMicrochipNumber(dog.microchip_number || "");
      setNotes(dog.notes || "");
      setBehaviorNotes(dog.behavior_notes || "");
      setMedicalNotes(dog.medical_notes || "");
      setAggression((dog.aggression_details as AggressionForm | null) ?? emptyAggression());
      setFeeding((dog.feeding as FeedingForm | null) ?? emptyFeeding());
      setPhotoUrl(dog.photo_url || null);
      setBreedOpen(false);
    } else {
      setCustomerId(preselectedCustomerId || "");
      setName(""); setBreed(""); setBirthDate(""); setWeight("");
      setColor(""); setGender("male"); setIsNeutered(false);
      setIsAggressive(false);
      setHasAllergies(false);
      setOnMedication(false);
      setMicrochipNumber(""); setNotes(""); setBehaviorNotes(""); setMedicalNotes("");
      setAggression(emptyAggression());
      setFeeding(emptyFeeding());
      setAllergies([]);
      setMedications([]);
      setPhotoUrl(null);
      setBreedOpen(false);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [dog, preselectedCustomerId, open]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (dogId: string): Promise<string | null> => {
    if (!photoFile) return photoUrl;

    setUploadingPhoto(true);
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const path = `${dogId}/photo.${ext}`;

    const { error } = await supabase.storage
      .from("dog-photos")
      .upload(path, photoFile, { upsert: true });

    setUploadingPhoto(false);

    if (error) {
      toast.error("No se pudo subir la foto", { description: "Usa una imagen menor a 5MB e inténtalo de nuevo." });
      return photoUrl;
    }

    const { data } = supabase.storage.from("dog-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const hasAggressionData = (a: AggressionForm) =>
    a.severity !== "" || a.handling.trim() !== "" ||
    a.requires_muzzle || a.handle_alone || a.no_other_dogs;

  // Intercepta el cambio del toggle: si se apaga con datos, pide confirmación.
  const toggleAggressive = (next: boolean) => {
    if (!next && hasAggressionData(aggression)) { setPendingClear("aggressive"); return; }
    setIsAggressive(next);
  };
  const toggleAllergies = (next: boolean) => {
    if (!next && allergies.length > 0) { setPendingClear("allergies"); return; }
    setHasAllergies(next);
  };
  const toggleMedication = (next: boolean) => {
    if (!next && medications.length > 0) { setPendingClear("medication"); return; }
    setOnMedication(next);
  };
  const confirmClear = () => {
    if (pendingClear === "aggressive") { setAggression(emptyAggression()); setIsAggressive(false); }
    if (pendingClear === "allergies") { setAllergies([]); setHasAllergies(false); }
    if (pendingClear === "medication") { setMedications([]); setOnMedication(false); }
    setPendingClear(null);
  };

  const pendingClearLabel =
    pendingClear === "aggressive" ? "agresividad" :
    pendingClear === "allergies" ? "alergias" :
    pendingClear === "medication" ? "medicación" : "";

  const foodAllergyWarning = allergies
    .filter((a) => a.type === "comida" && a.allergen.trim() !== "")
    .map((a) => a.allergen.trim());

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error("Selecciona un dueño");
      return;
    }
    const parsed = dogSchema.safeParse({
      name,
      breed,
      gender,
      weight: weight ? Number(weight) : null,
      color,
      microchip_number: microchipNumber,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Revisa los campos");
      return;
    }
    // Alimentación obligatoria.
    const feedingParsed = feedingSchema.safeParse(feeding);
    if (!feedingParsed.success) {
      toast.error("Completa la alimentación", {
        description: feedingParsed.error.issues[0]?.message,
      });
      return;
    }
    // Sub-forms requeridos cuando su toggle está activo.
    if (isAggressive) {
      const r = aggressionDetailsSchema.safeParse(aggression);
      if (!r.success) { toast.error("Completa los datos de agresividad", { description: r.error.issues[0]?.message }); return; }
    }
    if (hasAllergies) {
      if (allergies.length === 0) { toast.error("Añade al menos una alergia o apaga el interruptor"); return; }
      const bad = allergies.find((a) => !allergyRowSchema.safeParse(a).success);
      if (bad) { toast.error("Revisa las alergias", { description: "Cada alergia necesita alérgeno y tipo." }); return; }
    }
    if (onMedication) {
      if (medications.length === 0) { toast.error("Añade al menos un medicamento o apaga el interruptor"); return; }
      const bad = medications.find((m) => !medicationRowSchema.safeParse(m).success);
      if (bad) { toast.error("Revisa la medicación", { description: "Cada medicamento necesita un nombre." }); return; }
    }
    setIsSubmitting(true);

    try {
      // If creating, save first to get the ID, then upload photo
      const dogId = dog?.id ?? crypto.randomUUID();
      const uploadedPhotoUrl = await uploadPhoto(dogId);

      await onSave({
        id: dogId,
        customer_id: customerId,
        name,
        breed,
        birth_date: birthDate || null,
        weight: weight || null,
        color: color || null,
        gender,
        is_neutered: isNeutered,
        is_aggressive: isAggressive,
        has_allergies: hasAllergies,
        on_medication: onMedication,
        microchip_number: microchipNumber || null,
        notes,
        behavior_notes: behaviorNotes,
        medical_notes: medicalNotes,
        photo_url: uploadedPhotoUrl,
        aggression_details: isAggressive ? aggression : null,
        feeding,
        allergies: hasAllergies ? allergies : [],
        medications: onMedication ? medications : [],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPhoto = photoPreview ?? photoUrl;

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
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {currentPhoto ? (
                  <AvatarImage src={currentPhoto} alt={name || "Perro"} className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    <DogIcon className="h-10 w-10" />
                  </AvatarFallback>
                )}
              </Avatar>
              {currentPhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="dog-photo-button">Foto del perro</Label>
              <div className="flex gap-2">
                <Button
                  id="dog-photo-button"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {currentPhoto ? "Cambiar foto" : "Subir foto"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG o WebP · máx. 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dog-owner">Dueño *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="dog-owner"><SelectValue placeholder="Seleccionar dueño" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dog-name">Nombre *</Label>
              <Input id="dog-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del perro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-breed">Raza *</Label>
              <Popover open={breedOpen} onOpenChange={setBreedOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="dog-breed"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={breedOpen}
                    className="w-full justify-between font-normal text-left"
                  >
                    <span className="truncate">{breed || "Seleccionar raza..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar raza..."
                      value={breed}
                      onValueChange={setBreed}
                    />
                    <CommandEmpty>
                      <p className="text-xs text-muted-foreground px-3 py-2">
                        No encontrada — se guardará "{breed}".
                      </p>
                    </CommandEmpty>
                    <CommandGroup className="max-h-52 overflow-auto">
                      {DOG_BREEDS.filter((b) =>
                        b.toLowerCase().includes((breed ?? "").toLowerCase())
                      ).map((b) => (
                        <CommandItem
                          key={b}
                          value={b}
                          onSelect={(val) => {
                            setBreed(val);
                            setBreedOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", breed === b ? "opacity-100" : "opacity-0")} />
                          {b}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dog-gender">Género</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                <SelectTrigger id="dog-gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">♂ Macho</SelectItem>
                  <SelectItem value="female">♀ Hembra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-birth-date">Fecha de nacimiento</Label>
              <Input id="dog-birth-date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-weight">Peso (kg)</Label>
              <Input id="dog-weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dog-color">Color</Label>
              <Input id="dog-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color del pelaje" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-microchip">Microchip</Label>
              <Input id="dog-microchip" value={microchipNumber} onChange={(e) => setMicrochipNumber(e.target.value)} placeholder="Número de microchip" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="dog-neutered" checked={isNeutered} onCheckedChange={setIsNeutered} />
            <Label htmlFor="dog-neutered">{gender === "male" ? "Castrado" : "Esterilizada"}</Label>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold">Alertas de comportamiento/salud</Label>

            {/* Agresivo */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-aggressive" aria-label="Perro agresivo"
                  checked={isAggressive} onCheckedChange={toggleAggressive} />
                <Label htmlFor="toggle-aggressive"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Perro agresivo
                </Label>
              </div>
              {isAggressive && <AggressionFields value={aggression} onChange={setAggression} />}
            </div>

            {/* Alergias */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-allergies" aria-label="Tiene alergias"
                  checked={hasAllergies} onCheckedChange={toggleAllergies} />
                <Label htmlFor="toggle-allergies"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-amber-700">
                  <Leaf className="h-4 w-4" /> Tiene alergias
                </Label>
              </div>
              {hasAllergies && <AllergyList value={allergies} onChange={setAllergies} />}
            </div>

            {/* Medicación */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-medication" aria-label="En medicación"
                  checked={onMedication} onCheckedChange={toggleMedication} />
                <Label htmlFor="toggle-medication"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-blue-700">
                  <Pill className="h-4 w-4" /> En medicación
                </Label>
              </div>
              {onMedication && <MedicationList value={medications} onChange={setMedications} />}
            </div>
          </div>

          {/* Alimentación (obligatoria, siempre visible) */}
          <FeedingFields value={feeding} onChange={setFeeding} foodAllergyWarning={foodAllergyWarning} />

          <div className="space-y-2">
            <Label htmlFor="dog-notes">Notas generales</Label>
            <Textarea id="dog-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre el perro..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-behavior-notes">Notas de comportamiento</Label>
            <Textarea id="dog-behavior-notes" value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} placeholder="Comportamiento, reactividad, sociabilidad..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-medical-notes">Notas médicas</Label>
            <Textarea id="dog-medical-notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Condiciones médicas, alergias, medicamentos..." rows={2} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || uploadingPhoto}>
            {isSubmitting || uploadingPhoto ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Guardar cambios" : "Crear perro"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={pendingClear !== null} onOpenChange={(o) => !o && setPendingClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Descartar los datos de {pendingClearLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apagar este interruptor borrará los datos que cargaste en {pendingClearLabel}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
