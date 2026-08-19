import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StarRating } from "./StarRating";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCardFormData {
  dog_id: string;
  dog_name: string;
  trainer_id: string;
  service_type: string;
  session_date: Date;
  overall_score: number;
  energy_level: number;
  socialization: number;
  obedience: number;
  appetite: number;
  notes: string;
  highlights: string;
  areas_to_improve: string;
  photos: string[];
  is_sent: boolean;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface ReportCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
  onSaved: () => void;
}


const defaultForm: ReportCardFormData = {
  dog_id: "",
  dog_name: "",
  trainer_id: "",
  service_type: "daycare",
  session_date: new Date(),
  overall_score: 3,
  energy_level: 3,
  socialization: 3,
  obedience: 3,
  appetite: 3,
  notes: "",
  highlights: "",
  areas_to_improve: "",
  photos: [],
  is_sent: false,
};

interface DbDog { id: string; name: string; breed: string; }

export function ReportCardModal({ open, onOpenChange, editData, onSaved }: ReportCardModalProps) {
  const { organization } = useOrganization();
  const SERVICE_TYPES = useMemo(() =>
    organization?.service_types?.length
      ? organization.service_types
      : [
          { value: "daycare", label: "Guardería" },
          { value: "board_and_train", label: "Internado + Entrenamiento" },
          { value: "training_session", label: "Sesión de Entrenamiento" },
          { value: "grooming", label: "Grooming" },
          { value: "evaluation", label: "Evaluación" },
        ],
    [organization?.service_types]
  );
  const [form, setForm] = useState<ReportCardFormData>(defaultForm);
  const [trainers, setTrainers] = useState<StaffMember[]>([]);
  const [dogs, setDogs] = useState<DbDog[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadTrainers = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from("staff_members")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .eq("organization_id", organization.id)
      // Solo entrenadores o roles que gestionan report cards (admin/manager).
      .or("specialty.eq.trainer,role.in.(admin,manager)")
      .order("first_name");
    if (data) setTrainers(data);
  }, [organization]);

  const loadDogs = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from("dogs")
      .select("id, name, breed")
      .eq("organization_id", organization.id)
      .order("name");
    if (data) setDogs(data as DbDog[]);
  }, [organization]);

  useEffect(() => {
    if (open) {
      loadTrainers();
      loadDogs();
      if (editData) {
        setForm({
          dog_id: editData.dog_id,
          dog_name: editData.dog_name,
          trainer_id: editData.trainer_id || "",
          service_type: editData.service_type,
          session_date: new Date(editData.session_date),
          overall_score: editData.overall_score,
          energy_level: editData.energy_level,
          socialization: editData.socialization,
          obedience: editData.obedience,
          appetite: editData.appetite,
          notes: editData.notes || "",
          highlights: editData.highlights || "",
          areas_to_improve: editData.areas_to_improve || "",
          photos: editData.photos || [],
          is_sent: editData.is_sent,
        });
      } else {
        setForm({ ...defaultForm, service_type: SERVICE_TYPES[0]?.value ?? "daycare" });
      }
    }
  }, [open, editData, SERVICE_TYPES, loadTrainers, loadDogs]);


  function handleDogChange(dogId: string) {
    const dog = dogs.find((d) => d.id === dogId);
    setForm((f) => ({ ...f, dog_id: dogId, dog_name: dog?.name || "" }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || form.photos.length >= 4) return;

    setUploading(true);
    const newPhotos = [...form.photos];

    for (let i = 0; i < Math.min(files.length, 4 - form.photos.length); i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("report-card-photos").upload(path, file);
      if (error) {
        toast.error(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("report-card-photos").getPublicUrl(path);
      newPhotos.push(urlData.publicUrl);
    }

    setForm((f) => ({ ...f, photos: newPhotos }));
    setUploading(false);
  }

  function removePhoto(index: number) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }));
  }

  async function handleSave(sendToOwner: boolean) {
    if (!form.dog_id) {
      toast.error("Selecciona un perro");
      return;
    }

    setSaving(true);
    const payload = {
      dog_id: form.dog_id,
      dog_name: form.dog_name,
      trainer_id: form.trainer_id || null,
      service_type: form.service_type,
      session_date: format(form.session_date, "yyyy-MM-dd"),
      overall_score: form.overall_score,
      energy_level: form.energy_level,
      socialization: form.socialization,
      obedience: form.obedience,
      appetite: form.appetite,
      notes: form.notes,
      highlights: form.highlights,
      areas_to_improve: form.areas_to_improve,
      photos: form.photos,
      updated_at: new Date().toISOString(),
    };

    let error;
    let savedId = editData?.id as string | undefined;
    if (editData?.id) {
      ({ error } = await supabase.from("report_cards").update({ ...payload, organization_id: organization!.id }).eq("id", editData.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("report_cards")
        .insert({ ...payload, organization_id: organization!.id })
        .select("id")
        .single();
      error = insertError;
      savedId = data?.id;
    }

    if (error) {
      setSaving(false);
      toast.error("No se pudo guardar el report card", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return;
    }

    if (sendToOwner && savedId) {
      const { data: sendData, error: sendError } = await supabase.functions.invoke("send-report-card", {
        body: { reportCardId: savedId },
      });
      setSaving(false);
      if (sendError || !sendData?.success) {
        toast.error("Se guardó, pero no se pudo enviar el correo", {
          description: sendData?.error || sendError?.message || "Puedes reintentar el envío desde la lista.",
        });
        onOpenChange(false);
        onSaved();
        return;
      }
      toast.success("Report card enviado al dueño por correo");
    } else {
      setSaving(false);
      toast.success("Borrador guardado");
    }

    onOpenChange(false);
    onSaved();
  }

  const metrics = [
    { key: "overall_score" as const, label: "Puntuación General" },
    { key: "energy_level" as const, label: "Energía" },
    { key: "socialization" as const, label: "Socialización" },
    { key: "obedience" as const, label: "Obediencia" },
    { key: "appetite" as const, label: "Apetito" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Report Card" : "Nuevo Report Card"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Dog + Trainer + Service row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Perro *</Label>
              <Select value={form.dog_id} onValueChange={handleDogChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {dogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.breed})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Entrenador</Label>
              <Select value={form.trainer_id} onValueChange={(v) => setForm((f) => ({ ...f, trainer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {trainers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Fecha de sesión</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.session_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.session_date ? format(form.session_date, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.session_date} onSelect={(d) => d && setForm((f) => ({ ...f, session_date: d }))} locale={es} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Metrics */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Métricas</Label>
            <div className="grid gap-3 bg-muted/50 rounded-lg p-4">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{m.label}</span>
                  <StarRating value={form[m.key]} onChange={(v) => setForm((f) => ({ ...f, [m.key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Text fields */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="¿Cómo estuvo el perro hoy?" rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Logros destacados ✨</Label>
              <Textarea value={form.highlights} onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))} placeholder="Lo que hizo muy bien..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Áreas de mejora 📋</Label>
              <Textarea value={form.areas_to_improve} onChange={(e) => setForm((f) => ({ ...f, areas_to_improve: e.target.value }))} placeholder="En qué seguir trabajando..." rows={2} />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-1.5">
            <Label>Fotos (máx. 4)</Label>
            <div className="flex flex-wrap gap-3">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={url} alt="" width={80} height={80} loading="lazy" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {form.photos.length < 4 && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar borrador
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Enviar al dueño
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
