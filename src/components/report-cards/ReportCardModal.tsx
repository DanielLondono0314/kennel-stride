import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StarRating } from "./StarRating";
import { ServiceFields } from "./ServiceFields";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/age";
import { useDraftForm } from "@/hooks/useDraftForm";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { DraftBanner } from "@/components/shared/DraftBanner";
import { SPECIALTY_LABELS, type Specialty } from "@/lib/worker";
import {
  CATEGORY_CONFIG,
  COLUMN_METRICS,
  buildReportCardPayload,
  readDetails,
  type DetailValue,
} from "@/lib/reportCardServices";

interface ReportCardFormData {
  dog_id: string;
  dog_name: string;
  trainer_id: string;
  service_type: string;
  session_date: Date;
  overall_score: number;
  /** Métricas de 1 a 5 de la categoría (columnas clásicas y propias). */
  ratings: Record<string, number>;
  /** Campos propios del servicio (grooming, veterinaria, paseo…). */
  values: Record<string, DetailValue>;
  notes: string;
  highlights: string;
  areas_to_improve: string;
  photos: string[];
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  specialty: Specialty | null;
}

interface ReportCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
  /** Perro preseleccionado al crear (p. ej. desde el perfil del perro). */
  defaultDogId?: string;
  onSaved: () => void;
}

const MAX_PHOTOS = 4;

const emptyForm = (serviceType: string): ReportCardFormData => ({
  dog_id: "",
  dog_name: "",
  trainer_id: "",
  service_type: serviceType,
  session_date: new Date(),
  overall_score: 3,
  ratings: {},
  values: {},
  notes: "",
  highlights: "",
  areas_to_improve: "",
  photos: [],
});

interface DbDog { id: string; name: string; breed: string; }

export function ReportCardModal({ open, onOpenChange, editData, defaultDogId, onSaved }: ReportCardModalProps) {
  const { organization } = useOrganization();
  const { options: serviceTypes, labels: serviceLabels, categoryFor } = useServiceTypes();
  const firstService = serviceTypes[0]?.value ?? "daycare";

  const [form, setForm] = useState<ReportCardFormData>(() => emptyForm(firstService));
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [dogs, setDogs] = useState<DbDog[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const category = categoryFor(form.service_type);
  const cfg = CATEGORY_CONFIG[category];

  const loadStaff = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from("staff_members")
      .select("id, first_name, last_name, specialty")
      .eq("is_active", true)
      .eq("organization_id", organization.id)
      .order("first_name");
    if (data) setStaff(data as StaffMember[]);
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
    if (!open) return;
    loadStaff();
    loadDogs();
    if (editData) {
      const details = readDetails(editData.details);
      const ratings: Record<string, number> = { ...(details.ratings ?? {}) };
      for (const k of COLUMN_METRICS) {
        if (editData[k] != null) ratings[k] = editData[k];
      }
      setForm({
        dog_id: editData.dog_id,
        dog_name: editData.dog_name,
        trainer_id: editData.trainer_id || "",
        service_type: editData.service_type,
        session_date: parseDateOnly(editData.session_date),
        overall_score: editData.overall_score,
        ratings,
        values: details.values ?? {},
        notes: editData.notes || "",
        highlights: editData.highlights || "",
        areas_to_improve: editData.areas_to_improve || "",
        photos: editData.photos || [],
      });
    } else {
      setForm(emptyForm(firstService));
    }
  }, [open, editData, firstService, loadStaff, loadDogs]);

  // Perro preseleccionado: se aplica cuando ya cargó la lista (para tener el nombre).
  useEffect(() => {
    if (!open || editData || !defaultDogId) return;
    const dog = dogs.find((d) => d.id === defaultDogId);
    if (dog) setForm((f) => (f.dog_id ? f : { ...f, dog_id: dog.id, dog_name: dog.name }));
  }, [open, editData, defaultDogId, dogs]);

  // Borrador local: si cierran el modal sin guardar (cambio de pestaña/app,
  // Escape, clic afuera), no se pierde lo llenado. Solo para creación.
  const draftKey = organization?.id && !editData ? `reportCardDraft:${organization.id}:new` : null;
  const { hasDraft, clearDraft } = useDraftForm({
    key: draftKey,
    active: open,
    value: form,
    apply: (d) => setForm({ ...emptyForm(firstService), ...d, session_date: new Date(d.session_date) }),
    isEmpty: (v) =>
      !v.dog_id && !v.notes.trim() && !v.highlights.trim() && !v.areas_to_improve.trim() &&
      v.photos.length === 0 && Object.keys(v.values ?? {}).length === 0,
  });

  const discardDraft = () => {
    clearDraft();
    setForm(emptyForm(firstService));
  };

  // Encargados sugeridos para el servicio primero; el resto también se puede
  // elegir (un entrenador puede sacar a pasear, un admin puede hacer el baño).
  const staffGroups = useMemo(() => {
    const suggested = staff.filter((s) => s.specialty && cfg.specialties.includes(s.specialty));
    const others = staff.filter((s) => !suggested.includes(s));
    return { suggested, others };
  }, [staff, cfg.specialties]);

  function handleDogChange(dogId: string) {
    const dog = dogs.find((d) => d.id === dogId);
    setForm((f) => ({ ...f, dog_id: dogId, dog_name: dog?.name || "" }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || form.photos.length >= MAX_PHOTOS || !organization) return;
    setUploading(true);
    const newPhotos = [...form.photos];
    for (let i = 0; i < Math.min(files.length, MAX_PHOTOS - form.photos.length); i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      // Prefijo de org: las políticas de storage solo permiten escribir en la
      // carpeta de una organización del usuario.
      const path = `${organization.id}/${crypto.randomUUID()}.${ext}`;
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
    e.target.value = "";
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

    const { columns, details } = buildReportCardPayload({
      category,
      serviceLabel: serviceLabels[form.service_type] ?? form.service_type,
      overall: form.overall_score,
      ratings: form.ratings,
      values: form.values,
    });

    const payload = {
      dog_id: form.dog_id,
      dog_name: form.dog_name,
      trainer_id: form.trainer_id || null,
      service_type: form.service_type,
      service_category: category,
      session_date: format(form.session_date, "yyyy-MM-dd"),
      overall_score: form.overall_score,
      ...columns,
      details: details as never,
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
    clearDraft();

    if (sendToOwner && savedId) {
      const { data: sendData, error: sendError } = await supabase.functions.invoke("send-report-card", {
        body: { reportCardId: savedId },
      });
      setSaving(false);
      if (sendError || !sendData?.success) {
        const description = sendError
          ? await getFunctionErrorMessage(sendError, "Puedes reintentar el envío desde la lista.")
          : sendData?.error || "Puedes reintentar el envío desde la lista.";
        toast.error("Se guardó, pero no se pudo enviar el correo", { description });
        onOpenChange(false);
        onSaved();
        return;
      }
      toast.success("Report card enviado al dueño por correo");
    } else {
      setSaving(false);
      toast.success(editData?.is_sent ? "Report card actualizado" : "Borrador guardado");
    }
    onOpenChange(false);
    onSaved();
  }

  const renderStaffItem = (s: StaffMember) => (
    <SelectItem key={s.id} value={s.id}>
      {s.first_name} {s.last_name}
      {s.specialty && <span className="text-muted-foreground"> · {SPECIALTY_LABELS[s.specialty]}</span>}
    </SelectItem>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Report Card" : "Nuevo Report Card"}</DialogTitle>
          <DialogDescription>
            {cfg.icon} {cfg.label} · el formulario se adapta al servicio seleccionado.
          </DialogDescription>
          {hasDraft && <DraftBanner onDiscard={discardDraft} />}
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Servicio + perro + encargado + fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-service">Servicio *</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
                <SelectTrigger id="rc-service"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {CATEGORY_CONFIG[categoryFor(s.value)].icon} {s.label}
                    </SelectItem>
                  ))}
                  {!serviceLabels[form.service_type] && (
                    <SelectItem value={form.service_type}>{form.service_type}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-dog">Perro *</Label>
              <Select value={form.dog_id} onValueChange={handleDogChange}>
                <SelectTrigger id="rc-dog"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {dogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.breed && <span className="text-muted-foreground">({d.breed})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-staff">{cfg.staffLabel} (encargado)</Label>
              <Select value={form.trainer_id} onValueChange={(v) => setForm((f) => ({ ...f, trainer_id: v }))}>
                <SelectTrigger id="rc-staff"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {staffGroups.suggested.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Sugeridos para {cfg.label.toLowerCase()}</SelectLabel>
                      {staffGroups.suggested.map(renderStaffItem)}
                    </SelectGroup>
                  )}
                  {staffGroups.others.length > 0 && (
                    <SelectGroup>
                      {staffGroups.suggested.length > 0 && <SelectLabel>Otro personal</SelectLabel>}
                      {staffGroups.others.map(renderStaffItem)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha del servicio</Label>
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
          </div>

          {/* Detalle propio del servicio */}
          {cfg.fields.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Detalle de {cfg.label.toLowerCase()}</h3>
              <ServiceFields
                fields={cfg.fields}
                values={form.values}
                onChange={(key, value) => setForm((f) => ({ ...f, values: { ...f.values, [key]: value } }))}
              />
            </section>
          )}

          {/* ¿Cómo estuvo? */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold">¿Cómo estuvo el proceso?</h3>
            <div className="grid gap-3 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Puntuación general</span>
                <StarRating value={form.overall_score} onChange={(v) => setForm((f) => ({ ...f, overall_score: v }))} />
              </div>
              {cfg.metrics.map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{m.label}</span>
                  <StarRating
                    value={form.ratings[m.key] ?? 3}
                    onChange={(v) => setForm((f) => ({ ...f, ratings: { ...f.ratings, [m.key]: v } }))}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="rc-notes">Observaciones</Label>
            <Textarea id="rc-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="¿Cómo estuvo el perro hoy?" rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-highlights">{cfg.highlightsLabel} ✨</Label>
              <Textarea id="rc-highlights" value={form.highlights} onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-improve">{cfg.improveLabel} 📋</Label>
              <Textarea id="rc-improve" value={form.areas_to_improve} onChange={(e) => setForm((f) => ({ ...f, areas_to_improve: e.target.value }))} rows={2} />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-1.5">
            <Label>{cfg.photosLabel} (máx. {MAX_PHOTOS})</Label>
            <div className="flex flex-wrap gap-3">
              {form.photos.map((url, i) => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={url} alt={`Foto ${i + 1}`} width={80} height={80} loading="lazy" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} aria-label={`Quitar foto ${i + 1}`} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {form.photos.length < MAX_PHOTOS && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <span className="sr-only">Subir fotos</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {editData?.is_sent ? "Guardar cambios" : "Guardar borrador"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {editData?.is_sent ? "Guardar y reenviar" : "Enviar al dueño"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
