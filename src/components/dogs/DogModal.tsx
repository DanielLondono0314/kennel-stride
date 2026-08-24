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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dog as DogIcon, Loader2, Save, Camera, X, Check, ChevronsUpDown, AlertTriangle, Leaf, Pill } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DOG_BREEDS } from "@/lib/constants";
import {
  dogSchema, feedingSchema, aggressionDetailsSchema, allergyRowSchema, medicationRowSchema,
} from "@/lib/schemas";
import { zodFieldErrors, focusFirstInvalid } from "@/lib/forms";
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

type TabId = "basicos" | "alimentacion" | "salud";

// A qué tab pertenece cada campo con error, para saltar al primero que falle.
const FIELD_TAB: Record<string, TabId> = {
  customer_id: "basicos",
  name: "basicos",
  breed: "basicos",
  weight: "basicos",
  color: "basicos",
  microchip_number: "basicos",
  "feeding.food_type": "alimentacion",
  "feeding.meals_per_day": "alimentacion",
  "aggression.severity": "salud",
  "aggression.handling": "salud",
  allergies: "salud",
  medications: "salud",
  notes: "salud",
};

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
  const [preferredUnitId, setPreferredUnitId] = useState("");
  const [facilityUnits, setFacilityUnits] = useState<{ id: string; name: string }[]>([]);
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
  const [activeTab, setActiveTab] = useState<TabId>("basicos");
  // Errores inline por campo (PR-13): el toast queda solo como resumen.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const orgId = organization?.id;

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .order("first_name")
      .then(({ data }) => {
        if (data) setCustomers(data);
      });
  }, [orgId]);

  // Perreras de la org, para asignar (opcionalmente) una preferida al crear/editar.
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("facility_units")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name")
      .then(({ data }) => {
        if (data) setFacilityUnits(data);
      });
  }, [orgId]);

  // Cargar alergias/medicación al abrir en modo edición.
  useEffect(() => {
    if (!open || !dog?.id) return;
    (async () => {
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
      setPreferredUnitId(dog.preferred_unit_id || "");
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
      setMicrochipNumber(""); setPreferredUnitId(""); setNotes(""); setBehaviorNotes(""); setMedicalNotes("");
      setAggression(emptyAggression());
      setFeeding(emptyFeeding());
      setAllergies([]);
      setMedications([]);
      setPhotoUrl(null);
      setBreedOpen(false);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
    setErrors({});
    setActiveTab("basicos");
    setHasDraft(false);
  }, [dog, preselectedCustomerId, open]);

  // Borrador local: si cambian de pestaña/app o cierran el modal por accidente
  // mientras registran un perro NUEVO (sin guardar), no se pierde el trabajo —
  // se recupera solo al volver a abrir "Nuevo perro". Solo para creación: al
  // editar, el prop `dog` ya trae los valores guardados, así que el riesgo de
  // "empezar de cero" no aplica igual.
  const draftKey = orgId && !isEditing ? `dogDraft:${orgId}:new` : null;
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (!open || !draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.customerId) setCustomerId(d.customerId);
      if (d.name) setName(d.name);
      if (d.breed) setBreed(d.breed);
      if (d.birthDate) setBirthDate(d.birthDate);
      if (d.weight) setWeight(d.weight);
      if (d.color) setColor(d.color);
      if (d.gender) setGender(d.gender);
      setIsNeutered(!!d.isNeutered);
      setIsAggressive(!!d.isAggressive);
      setHasAllergies(!!d.hasAllergies);
      setOnMedication(!!d.onMedication);
      if (d.microchipNumber) setMicrochipNumber(d.microchipNumber);
      if (d.preferredUnitId) setPreferredUnitId(d.preferredUnitId);
      if (d.notes) setNotes(d.notes);
      if (d.behaviorNotes) setBehaviorNotes(d.behaviorNotes);
      if (d.medicalNotes) setMedicalNotes(d.medicalNotes);
      if (d.aggression) setAggression(d.aggression);
      if (d.feeding) setFeeding(d.feeding);
      if (Array.isArray(d.allergies)) setAllergies(d.allergies);
      if (Array.isArray(d.medications)) setMedications(d.medications);
      setHasDraft(true);
      toast.info("Recuperamos un borrador sin guardar", {
        description: "Tenías datos de un registro anterior que no se guardó.",
      });
    } catch {
      localStorage.removeItem(draftKey);
    }
    // Solo al abrir — no se debe re-disparar mientras escriben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  useEffect(() => {
    if (!open || !draftKey) return;
    const isEmpty = !name.trim() && !breed.trim() && !notes.trim() && !behaviorNotes.trim()
      && !medicalNotes.trim() && !weight && !color.trim() && !microchipNumber.trim()
      && allergies.length === 0 && medications.length === 0;
    if (isEmpty) {
      localStorage.removeItem(draftKey);
      return;
    }
    const snapshot = {
      customerId, name, breed, birthDate, weight, color, gender, isNeutered, isAggressive,
      hasAllergies, onMedication, microchipNumber, preferredUnitId, notes, behaviorNotes,
      medicalNotes, aggression, feeding, allergies, medications,
    };
    localStorage.setItem(draftKey, JSON.stringify(snapshot));
  }, [
    open, draftKey, customerId, name, breed, birthDate, weight, color, gender, isNeutered,
    isAggressive, hasAllergies, onMedication, microchipNumber, preferredUnitId, notes,
    behaviorNotes, medicalNotes, aggression, feeding, allergies, medications,
  ]);

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
    if (!next) clearError("allergies");
  };
  const toggleMedication = (next: boolean) => {
    if (!next && medications.length > 0) { setPendingClear("medication"); return; }
    setOnMedication(next);
    if (!next) clearError("medications");
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

  /** Valida todo el formulario y devuelve el mapa de errores por campo. */
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (!customerId) errs.customer_id = "Selecciona un dueño";

    const parsed = dogSchema.safeParse({
      name,
      breed,
      gender,
      weight: weight ? Number(weight) : null,
      color,
      microchip_number: microchipNumber,
      notes,
    });
    if (!parsed.success) Object.assign(errs, zodFieldErrors(parsed.error));

    // Alimentación obligatoria.
    const feedingParsed = feedingSchema.safeParse(feeding);
    if (!feedingParsed.success) {
      for (const [k, v] of Object.entries(zodFieldErrors(feedingParsed.error))) {
        errs[`feeding.${k}`] = v;
      }
    }

    // Sub-forms requeridos cuando su toggle está activo.
    if (isAggressive) {
      const r = aggressionDetailsSchema.safeParse(aggression);
      if (!r.success) {
        for (const [k, v] of Object.entries(zodFieldErrors(r.error))) {
          errs[`aggression.${k}`] = v;
        }
      }
    }
    if (hasAllergies) {
      if (allergies.length === 0) errs.allergies = "Añade al menos una alergia o apaga el interruptor";
      else if (allergies.some((a) => !allergyRowSchema.safeParse(a).success)) {
        errs.allergies = "Cada alergia necesita alérgeno y tipo";
      }
    }
    if (onMedication) {
      if (medications.length === 0) errs.medications = "Añade al menos un medicamento o apaga el interruptor";
      else if (medications.some((m) => !medicationRowSchema.safeParse(m).success)) {
        errs.medications = "Cada medicamento necesita un nombre";
      }
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Salta al tab que contiene el primer error y enfoca el campo.
      const firstField = Object.keys(errs)[0];
      const tab = FIELD_TAB[firstField] ?? "basicos";
      setActiveTab(tab);
      focusFirstInvalid(contentRef.current);
      toast.error("Revisa los campos marcados", {
        description: `${Object.keys(errs).length} campo(s) por corregir`,
      });
      return;
    }
    setErrors({});
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
        preferred_unit_id: preferredUnitId || null,
        notes,
        behavior_notes: behaviorNotes,
        medical_notes: medicalNotes,
        photo_url: uploadedPhotoUrl,
        aggression_details: isAggressive ? aggression : null,
        feeding,
        allergies: hasAllergies ? allergies : [],
        medications: onMedication ? medications : [],
      });
      if (draftKey) localStorage.removeItem(draftKey);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPhoto = photoPreview ?? photoUrl;

  // Punto rojo en el tab que tiene errores pendientes.
  const tabHasErrors = (tab: TabId) =>
    Object.keys(errors).some((k) => (FIELD_TAB[k] ?? "basicos") === tab);

  const tabTriggerClass = "gap-1.5 data-[state=active]:font-semibold";
  const errorDot = <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive" />;

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
          {hasDraft && (
            <div className="flex items-center justify-between rounded-md bg-info/10 px-3 py-2 text-xs text-info">
              <span>Recuperamos un borrador sin guardar de un registro anterior.</span>
              <button
                type="button"
                className="font-medium underline underline-offset-2 hover:no-underline shrink-0 ml-2"
                onClick={() => {
                  if (draftKey) localStorage.removeItem(draftKey);
                  setHasDraft(false);
                  setCustomerId(preselectedCustomerId || "");
                  setName(""); setBreed(""); setBirthDate(""); setWeight("");
                  setColor(""); setGender("male"); setIsNeutered(false);
                  setIsAggressive(false); setHasAllergies(false); setOnMedication(false);
                  setMicrochipNumber(""); setPreferredUnitId(""); setNotes("");
                  setBehaviorNotes(""); setMedicalNotes("");
                  setAggression(emptyAggression()); setFeeding(emptyFeeding());
                  setAllergies([]); setMedications([]);
                }}
              >
                Descartar borrador
              </button>
            </div>
          )}
        </DialogHeader>

        <div ref={contentRef}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basicos" className={tabTriggerClass}>
              Datos básicos {tabHasErrors("basicos") && errorDot}
            </TabsTrigger>
            <TabsTrigger value="alimentacion" className={tabTriggerClass}>
              Alimentación {tabHasErrors("alimentacion") && errorDot}
            </TabsTrigger>
            <TabsTrigger value="salud" className={tabTriggerClass}>
              Salud y notas {tabHasErrors("salud") && errorDot}
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Datos básicos (obligatorios primero) ─────────────── */}
          <TabsContent value="basicos" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label htmlFor="dog-owner">Dueño *</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); clearError("customer_id"); }}>
                <SelectTrigger
                  id="dog-owner"
                  aria-invalid={errors.customer_id ? true : undefined}
                  aria-describedby={errors.customer_id ? "dog-owner-error" : undefined}
                  className={errors.customer_id ? "border-destructive focus:ring-destructive" : ""}
                ><SelectValue placeholder="Seleccionar dueño" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customer_id && <p id="dog-owner-error" className="text-xs text-destructive">{errors.customer_id}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dog-name">Nombre *</Label>
                <Input
                  id="dog-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError("name"); }}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "dog-name-error" : undefined}
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                  placeholder="Nombre del perro"
                />
                {errors.name && <p id="dog-name-error" className="text-xs text-destructive">{errors.name}</p>}
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
                      aria-invalid={errors.breed ? true : undefined}
                      aria-describedby={errors.breed ? "dog-breed-error" : undefined}
                      className={cn(
                        "w-full justify-between font-normal text-left",
                        errors.breed && "border-destructive focus-visible:ring-destructive"
                      )}
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
                        onValueChange={(v) => { setBreed(v); clearError("breed"); }}
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
                              clearError("breed");
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
                {errors.breed && <p id="dog-breed-error" className="text-xs text-destructive">{errors.breed}</p>}
              </div>
            </div>

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
                <Input
                  id="dog-weight"
                  type="number"
                  value={weight}
                  onChange={(e) => { setWeight(e.target.value); clearError("weight"); }}
                  aria-invalid={errors.weight ? true : undefined}
                  aria-describedby={errors.weight ? "dog-weight-error" : undefined}
                  className={errors.weight ? "border-destructive focus-visible:ring-destructive" : ""}
                  placeholder="0"
                />
                {errors.weight && <p id="dog-weight-error" className="text-xs text-destructive">{errors.weight}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dog-color">Color</Label>
                <Input id="dog-color" value={color} onChange={(e) => { setColor(e.target.value); clearError("color"); }} placeholder="Color del pelaje" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dog-microchip">Microchip</Label>
                <Input id="dog-microchip" value={microchipNumber} onChange={(e) => { setMicrochipNumber(e.target.value); clearError("microchip_number"); }} placeholder="Número de microchip" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="dog-neutered" checked={isNeutered} onCheckedChange={setIsNeutered} />
              <Label htmlFor="dog-neutered">{gender === "male" ? "Castrado" : "Esterilizada"}</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dog-preferred-unit">Perrera preferida (opcional)</Label>
              <Select value={preferredUnitId || "_none"} onValueChange={(v) => setPreferredUnitId(v === "_none" ? "" : v)}>
                <SelectTrigger id="dog-preferred-unit">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {facilityUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo de referencia — el check-in real ocupa la perrera según disponibilidad.
              </p>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Alimentación (obligatoria — ya no está al final) ─── */}
          <TabsContent value="alimentacion" className="mt-4">
            <FeedingFields
              value={feeding}
              onChange={(v) => { setFeeding(v); clearError("feeding.food_type"); clearError("feeding.meals_per_day"); }}
              foodAllergyWarning={foodAllergyWarning}
              errors={{
                food_type: errors["feeding.food_type"],
                meals_per_day: errors["feeding.meals_per_day"],
              }}
            />
          </TabsContent>

          {/* ─── Tab 3: Salud y notas ─────────────────────────────────────── */}
          <TabsContent value="salud" className="space-y-5 mt-4">
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
                {isAggressive && (
                  <AggressionFields
                    value={aggression}
                    onChange={(v) => { setAggression(v); clearError("aggression.severity"); clearError("aggression.handling"); }}
                    errors={{
                      severity: errors["aggression.severity"],
                      handling: errors["aggression.handling"],
                    }}
                  />
                )}
              </div>

              {/* Alergias */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <Switch id="toggle-allergies" aria-label="Tiene alergias"
                    aria-invalid={errors.allergies ? true : undefined}
                    checked={hasAllergies} onCheckedChange={toggleAllergies} />
                  <Label htmlFor="toggle-allergies"
                    className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-amber-700">
                    <Leaf className="h-4 w-4" /> Tiene alergias
                  </Label>
                </div>
                {errors.allergies && <p className="text-xs text-destructive">{errors.allergies}</p>}
                {hasAllergies && <AllergyList value={allergies} onChange={(v) => { setAllergies(v); clearError("allergies"); }} />}
              </div>

              {/* Medicación */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <Switch id="toggle-medication" aria-label="En medicación"
                    aria-invalid={errors.medications ? true : undefined}
                    checked={onMedication} onCheckedChange={toggleMedication} />
                  <Label htmlFor="toggle-medication"
                    className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-info">
                    <Pill className="h-4 w-4" /> En medicación
                  </Label>
                </div>
                {errors.medications && <p className="text-xs text-destructive">{errors.medications}</p>}
                {onMedication && <MedicationList value={medications} onChange={(v) => { setMedications(v); clearError("medications"); }} />}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dog-notes">Notas generales</Label>
              <Textarea
                id="dog-notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); clearError("notes"); }}
                aria-invalid={errors.notes ? true : undefined}
                placeholder="Notas sobre el perro..."
                rows={2}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-behavior-notes">Notas de comportamiento</Label>
              <Textarea id="dog-behavior-notes" value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} placeholder="Comportamiento, reactividad, sociabilidad..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-medical-notes">Notas médicas</Label>
              <Textarea id="dog-medical-notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Condiciones médicas, alergias, medicamentos..." rows={2} />
            </div>
          </TabsContent>
        </Tabs>
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
