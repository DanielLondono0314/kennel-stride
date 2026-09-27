import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useSaveContractTemplate, type ContractTemplate } from "@/hooks/queries/useContracts";
import {
  CONTRACT_VARIABLES,
  buildContractHtml,
  STARTER_TEMPLATES,
  extractCustomVariables,
  humanizeKey,
  readTemplateFile,
  renderTemplate,
  type ContractVariable,
} from "@/lib/contracts";
import { ContractDocument } from "./ContractDocument";

const ANY_SERVICE = "__any__";

const SAMPLE_VALUES: Record<string, string> = {
  negocio_nombre: "Mi Guardería Canina",
  negocio_direccion: "Calle 10 # 20-30",
  negocio_ciudad: "Medellín",
  negocio_telefono: "300 000 0000",
  negocio_email: "hola@miguarderia.com",
  cliente_nombre: "Ana Gómez",
  cliente_tipo_documento: "C.C.",
  cliente_documento: "1.020.304.050",
  cliente_telefono: "310 123 4567",
  cliente_email: "ana@correo.com",
  cliente_direccion: "Carrera 45 # 12-34",
  cliente_ciudad: "Medellín",
  contacto_emergencia: "Luis Gómez · 311 765 4321",
  mascotas: "**Luna** (Golden Retriever, hembra, Dorado, 3 años) y **Max** (Beagle, macho, 5 años)",
  perro_nombre: "Luna",
  perro_raza: "Golden Retriever",
  perro_sexo: "Hembra",
  perro_color: "Dorado",
  perro_edad: "3 años",
  perro_microchip: "985112000000000",
  servicio: "Paquete 20 días",
  servicios_incluidos: "cuidado diurno, alimentación y paseos",
  sesiones: "20",
  valor_total: "$800,000.00",
  valor_letras: "ochocientos mil",
  forma_pago: "transferencia bancaria",
  observaciones: "Ninguna",
  fecha_inicio: "1 de octubre de 2026",
  fecha_fin: "31 de octubre de 2026",
  duracion: "1 mes",
  fecha_hoy: "27 de septiembre de 2026",
};

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContractTemplate | null;
}

export function TemplateEditorDialog({ open, onOpenChange, template }: TemplateEditorDialogProps) {
  const { options: serviceOptions } = useServiceTypes();
  const save = useSaveContractTemplate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState(ANY_SERVICE);
  const [body, setBody] = useState("");
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState("edit");

  useEffect(() => {
    if (!open) return;
    setTab("edit");
    setName(template?.name ?? "");
    setServiceType(template?.service_type ?? ANY_SERVICE);
    setBody(template?.body ?? "");
    setIncludeSignatures(template?.include_signatures ?? true);
  }, [open, template]);

  const grouped = useMemo(() => {
    const out: Record<string, ContractVariable[]> = {};
    for (const v of CONTRACT_VARIABLES) (out[v.group] ??= []).push(v);
    return out;
  }, []);

  const customVars = useMemo(() => extractCustomVariables(body), [body]);

  const previewHtml = useMemo(() => {
    const sample = { ...SAMPLE_VALUES };
    for (const k of customVars) sample[k] = `[${humanizeKey(k)}]`;
    return buildContractHtml(
      renderTemplate(body, sample),
      includeSignatures
        ? [
            { role: "El prestador", name: SAMPLE_VALUES.negocio_nombre },
            { role: "El propietario", name: SAMPLE_VALUES.cliente_nombre, detail: `C.C. ${SAMPLE_VALUES.cliente_documento}` },
          ]
        : null
    );
  }, [body, includeSignatures, customVars]);

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const applyStarter = (id: string) => {
    const starter = STARTER_TEMPLATES.find((s) => s.id === id);
    if (!starter) return;
    if (body.trim() && !window.confirm("Esto reemplaza el texto actual de la plantilla. ¿Continuar?")) return;
    setBody(starter.body);
    if (!name.trim()) setName(starter.name);
    if (serviceType === ANY_SERVICE && serviceOptions.some((o) => o.value === starter.serviceHint)) {
      setServiceType(starter.serviceHint);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (body.trim() && !window.confirm("Esto reemplaza el texto actual de la plantilla. ¿Continuar?")) return;
    setImporting(true);
    try {
      const text = await readTemplateFile(file);
      setBody(text);
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
      toast.success("Plantilla importada", {
        description: "Revisa el texto y reemplaza los datos variables con {{variables}}.",
      });
    } catch (e) {
      toast.error("No se pudo importar el archivo", { description: (e as Error).message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (name.trim().length < 2) { toast.error("Ponle un nombre a la plantilla"); return; }
    if (!body.trim()) { toast.error("La plantilla está vacía"); return; }
    try {
      await save.mutateAsync({
        id: template?.id,
        name: name.trim(),
        service_type: serviceType === ANY_SERVICE ? null : serviceType,
        body,
        include_signatures: includeSignatures,
      });
      toast.success(template ? "Plantilla actualizada" : "Plantilla creada");
      onOpenChange(false);
    } catch {
      toast.error("No se pudo guardar la plantilla", { description: "Revisa tu conexión e inténtalo de nuevo." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar plantilla" : "Nueva plantilla de contrato"}</DialogTitle>
          <DialogDescription>
            Escribe o importa el texto del contrato y marca con variables los datos que cambian en cada cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nombre</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Paquete internado" maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de servicio</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_SERVICE}>Cualquier servicio</SelectItem>
                {serviceOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
          <span className="text-sm text-muted-foreground mr-1">Empezar desde:</span>
          {STARTER_TEMPLATES.map((s) => (
            <Button key={s.id} type="button" variant="outline" size="sm" onClick={() => applyStarter(s.id)}>
              Ejemplo {s.name.toLowerCase()}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            Importar .docx / .txt
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="edit">Texto</TabsTrigger>
            <TabsTrigger value="preview">Vista previa</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-3">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[420px] font-mono text-sm leading-relaxed"
                  placeholder={"# Contrato de prestación de servicios\n\nEntre {{negocio_nombre}} y {{cliente_nombre}}, identificado con documento {{cliente_documento}}…"}
                  aria-label="Texto de la plantilla"
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <code># Título</code>, <code>## Sección</code>, <code>**negrita**</code>. Deja una línea en blanco entre párrafos.
                    Puedes inventar variables propias, p. ej. <code>{"{{horario}}"}</code>: se pedirán al generar el contrato.
                  </span>
                </p>
              </div>

              <div className="space-y-3 lg:max-h-[460px] lg:overflow-y-auto pr-1">
                <p className="text-sm font-medium">Insertar variable</p>
                {Object.entries(grouped).map(([group, vars]) => (
                  <div key={group} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          className="rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={`{{${v.key}}}`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {customVars.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Propias (se piden al generar)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customVars.map((k) => <Badge key={k} variant="secondary">{humanizeKey(k)}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Con datos de ejemplo.</p>
            <ContractDocument html={previewHtml} className="max-h-[520px] overflow-y-auto" />
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2">
          <Switch id="tpl-sign" checked={includeSignatures} onCheckedChange={setIncludeSignatures} />
          <Label htmlFor="tpl-sign" className="font-normal">Agregar bloque de firmas al final</Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
