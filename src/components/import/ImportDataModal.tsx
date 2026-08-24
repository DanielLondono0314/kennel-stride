import { useState, useMemo } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "customers" | "dogs";
  onImported?: () => void;
}

type RawRow = Record<string, string>;
type Mode = "customers" | "dogs";

const CUSTOMER_HEADERS = [
  "first_name", "last_name", "email", "phone",
  "address", "city", "state", "zip_code",
  "emergency_contact_name", "emergency_contact_phone", "notes",
];

const DOG_HEADERS = [
  "name", "breed", "gender", "birth_date", "weight", "color",
  "microchip_number", "is_neutered", "is_aggressive", "has_allergies", "on_medication",
  "behavior_notes", "medical_notes",
  "feeding_type", "feeding_brand", "feeding_meals_per_day", "feeding_portion_amount", "feeding_portion_unit", "feeding_instructions",
  "aggression_severity", "aggression_handling", "aggression_requires_muzzle", "aggression_handle_alone", "aggression_no_other_dogs",
  "allergies", "medications",
  "preferred_unit_name",
  "notes", "owner_email", "owner_phone",
];

// Columnas de "grupo repetido" (un perro puede tener varias alergias o
// medicamentos): un campo de texto con entradas separadas por ";", cada
// entrada con sus partes separadas por ":". Se documenta en el modal.
// allergies:   alergeno:tipo:reaccion:severidad        (tipo: comida|ambiental|medicamento; severidad: baja|media|alta)
// medications: nombre:dosis:frecuencia:via:con_comida  (via: oral|topica|inyectable; con_comida: true|false)

const CUSTOMER_SAMPLE =
  CUSTOMER_HEADERS.join(",") +
  "\nJuan,Pérez,juan@example.com,5551234567,Calle 1,CDMX,CDMX,01000,María Pérez,5559876543,Cliente VIP" +
  "\nAna,García,ana@example.com,5557654321,,,,,,,";

const DOG_SAMPLE =
  DOG_HEADERS.join(",") +
  "\nFirulais,Labrador,male,2020-05-12,28,Negro,9821374,true,false,false,false,Muy juguetón,Sin novedades,seco,Marca X,2,300,g,Separar de otros perros,,,,,,,,Perrera 3,,juan@example.com," +
  "\nLuna,Poodle,female,,7,Blanco,,false,true,true,false,,,humedo,,3,150,g,,media,Manejar con correa corta,true,true,true,Pollo:comida:Picazón:media,Apoquel:5mg:cada 12h:oral:false,,Alérgica al pollo,ana@example.com,";

function normalizeRow(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const k of Object.keys(row)) {
    out[k.trim().toLowerCase()] = (row[k] ?? "").toString().trim();
  }
  return out;
}

function parseBool(v: string): boolean {
  return ["true", "1", "yes", "sí", "si", "x"].includes(v.toLowerCase());
}

interface AllergyEntry { allergen: string; type: string; reaction: string | null; severity: string | null; }
interface MedicationEntry { name: string; dose: string | null; frequency: string | null; route: string | null; with_food: boolean; }

// "alergeno:tipo:reaccion:severidad" por entrada, separadas por ";".
function parseAllergies(raw: string): AllergyEntry[] {
  if (!raw?.trim()) return [];
  return raw.split(";").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const [allergen, type, reaction, severity] = entry.split(":").map((p) => p?.trim() ?? "");
    return {
      allergen: allergen || entry,
      type: type || "comida",
      reaction: reaction || null,
      severity: severity || null,
    };
  });
}

// "nombre:dosis:frecuencia:via:con_comida" por entrada, separadas por ";".
function parseMedications(raw: string): MedicationEntry[] {
  if (!raw?.trim()) return [];
  return raw.split(";").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const [name, dose, frequency, route, withFood] = entry.split(":").map((p) => p?.trim() ?? "");
    return {
      name: name || entry,
      dose: dose || null,
      frequency: frequency || null,
      route: route || null,
      with_food: parseBool(withFood || ""),
    };
  });
}

function downloadTemplate(mode: Mode) {
  const content = mode === "customers" ? CUSTOMER_SAMPLE : DOG_SAMPLE;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = mode === "customers" ? "plantilla_clientes.csv" : "plantilla_perros.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface ImportResult {
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export function ImportDataModal({ open, onOpenChange, initialTab = "customers", onImported }: Props) {
  const { organization } = useOrganization();
  const [mode, setMode] = useState<Mode>(initialTab);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const headers = useMemo(() => (mode === "customers" ? CUSTOMER_HEADERS : DOG_HEADERS), [mode]);

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  const handleFile = (file: File) => {
    setParsing(true);
    setResult(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const normalized = (res.data as RawRow[]).map(normalizeRow);
        setRows(normalized);
        setFileName(file.name);
        setParsing(false);
        if (res.errors.length > 0) {
          toast.warning(`Archivo cargado con ${res.errors.length} advertencias`);
        } else {
          toast.success(`${normalized.length} fila(s) leída(s)`);
        }
      },
      error: (err) => {
        setParsing(false);
        toast.error("Error al leer CSV: " + err.message);
      },
    });
  };

  const importCustomers = async (): Promise<ImportResult> => {
    const out: ImportResult = { created: 0, updated: 0, linked: 0, skipped: 0, errors: [] };
    if (!organization) return out;

    // Pre-fetch existing emails for the org to detect duplicates
    const emails = rows.map(r => r.email?.toLowerCase()).filter(Boolean);
    const { data: existing } = await supabase
      .from("customers")
      .select("id, email")
      .eq("organization_id", organization.id)
      .in("email", emails.length > 0 ? emails : ["__none__"]);
    const existingMap = new Map((existing ?? []).map(c => [c.email.toLowerCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.first_name || !r.last_name || !r.email) {
        out.errors.push({ row: i + 2, reason: "Faltan campos requeridos (first_name, last_name, email)" });
        continue;
      }
      const payload = {
        organization_id: organization.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email.toLowerCase(),
        phone: r.phone || "",
        address: r.address || null,
        city: r.city || null,
        state: r.state || null,
        zip_code: r.zip_code || null,
        emergency_contact_name: r.emergency_contact_name || null,
        emergency_contact_phone: r.emergency_contact_phone || null,
        notes: r.notes || null,
      };
      const existingId = existingMap.get(payload.email);
      if (existingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", existingId);
        if (error) out.errors.push({ row: i + 2, reason: error.message });
        else out.updated++;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) out.errors.push({ row: i + 2, reason: error.message });
        else out.created++;
      }
    }
    return out;
  };

  const importDogs = async (): Promise<ImportResult> => {
    const out: ImportResult = { created: 0, updated: 0, linked: 0, skipped: 0, errors: [] };
    if (!organization) return out;

    // Fetch all customers for the org to match by email/phone
    const { data: customers } = await supabase
      .from("customers")
      .select("id, email, phone, first_name, last_name")
      .eq("organization_id", organization.id);
    const byEmail = new Map<string, string>((customers ?? []).map(c => [c.email.toLowerCase(), c.id] as [string, string]));
    const byPhone = new Map<string, string>((customers ?? []).filter(c => !!c.phone).map(c => [c.phone, c.id] as [string, string]));

    // Perreras de la org, para resolver preferred_unit_name -> preferred_unit_id
    const { data: units } = await supabase
      .from("facility_units")
      .select("id, name")
      .eq("organization_id", organization.id);
    const unitByName = new Map<string, string>((units ?? []).map(u => [u.name.toLowerCase(), u.id] as [string, string]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name || !r.breed) {
        out.errors.push({ row: i + 2, reason: "Faltan campos requeridos (name, breed)" });
        continue;
      }

      // Resolve customer
      let customerId: string | undefined;
      if (r.owner_email) customerId = byEmail.get(r.owner_email.toLowerCase());
      if (!customerId && r.owner_phone) customerId = byPhone.get(r.owner_phone);

      // Auto-create a placeholder customer if we have owner_email but no match
      if (!customerId && r.owner_email) {
        const placeholder = {
          organization_id: organization.id,
          first_name: r.owner_email.split("@")[0],
          last_name: "(Importado)",
          email: r.owner_email.toLowerCase(),
          phone: r.owner_phone || "",
        };
        const { data: newCust, error } = await supabase
          .from("customers")
          .insert(placeholder)
          .select("id")
          .single();
        if (error || !newCust) {
          out.errors.push({ row: i + 2, reason: "No se pudo crear cliente automático: " + (error?.message ?? "") });
          continue;
        }
        customerId = newCust.id;
        byEmail.set(placeholder.email, customerId);
        out.linked++;
      }

      if (!customerId) {
        out.errors.push({ row: i + 2, reason: "No se encontró cliente (provee owner_email)" });
        continue;
      }

      const allergyEntries = parseAllergies(r.allergies);
      const medicationEntries = parseMedications(r.medications);
      const isAggressive = parseBool(r.is_aggressive);

      const hasFeedingData = !!(r.feeding_type || r.feeding_brand || r.feeding_meals_per_day || r.feeding_portion_amount || r.feeding_instructions);
      const feeding = hasFeedingData ? {
        food_type: r.feeding_type || "",
        brand: r.feeding_brand || "",
        meals_per_day: r.feeding_meals_per_day ? Number(r.feeding_meals_per_day) || "" : "",
        portion_amount: r.feeding_portion_amount ? Number(r.feeding_portion_amount) || "" : "",
        portion_unit: r.feeding_portion_unit || "",
        instructions: r.feeding_instructions || "",
      } : null;

      const aggressionDetails = isAggressive ? {
        severity: r.aggression_severity || "",
        handling: r.aggression_handling || "",
        requires_muzzle: parseBool(r.aggression_requires_muzzle),
        handle_alone: parseBool(r.aggression_handle_alone),
        no_other_dogs: parseBool(r.aggression_no_other_dogs),
      } : null;

      const preferredUnitId = r.preferred_unit_name ? unitByName.get(r.preferred_unit_name.toLowerCase()) ?? null : null;
      if (r.preferred_unit_name && !preferredUnitId) {
        out.errors.push({ row: i + 2, reason: `Perrera "${r.preferred_unit_name}" no encontrada — se creó el perro sin asignar` });
      }

      const payload = {
        organization_id: organization.id,
        customer_id: customerId,
        name: r.name,
        breed: r.breed,
        gender: ["female", "hembra", "f"].includes(r.gender?.toLowerCase()) ? "female" : "male",
        birth_date: r.birth_date || null,
        weight: r.weight ? Number(r.weight) || null : null,
        color: r.color || null,
        microchip_number: r.microchip_number || null,
        is_neutered: parseBool(r.is_neutered),
        is_aggressive: isAggressive,
        has_allergies: parseBool(r.has_allergies) || allergyEntries.length > 0,
        on_medication: parseBool(r.on_medication) || medicationEntries.length > 0,
        behavior_notes: r.behavior_notes || null,
        medical_notes: r.medical_notes || null,
        feeding,
        aggression_details: aggressionDetails,
        preferred_unit_id: preferredUnitId,
        notes: r.notes || null,
      };
      const { data: newDog, error } = await supabase.from("dogs").insert(payload).select("id").single();
      if (error || !newDog) {
        out.errors.push({ row: i + 2, reason: error?.message ?? "No se pudo crear el perro" });
        continue;
      }

      if (allergyEntries.length > 0) {
        const { error: allergyErr } = await supabase.from("dog_allergies").insert(
          allergyEntries.map((a) => ({ ...a, dog_id: newDog.id, organization_id: organization.id }))
        );
        if (allergyErr) out.errors.push({ row: i + 2, reason: "Perro creado, pero fallaron sus alergias: " + allergyErr.message });
      }
      if (medicationEntries.length > 0) {
        const { error: medErr } = await supabase.from("dog_medications").insert(
          medicationEntries.map((m) => ({ ...m, dog_id: newDog.id, organization_id: organization.id }))
        );
        if (medErr) out.errors.push({ row: i + 2, reason: "Perro creado, pero fallaron sus medicamentos: " + medErr.message });
      }

      out.created++;
    }
    return out;
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      toast.error("No hay datos para importar");
      return;
    }
    setImporting(true);
    try {
      const res = mode === "customers" ? await importCustomers() : await importDogs();
      setResult(res);
      const totalOk = res.created + res.updated;
      if (totalOk > 0) {
        toast.success(`Importación completada: ${totalOk} registro(s)`);
        onImported?.();
      }
      if (res.errors.length > 0) {
        toast.warning(`${res.errors.length} fila(s) con errores`);
      }
    } catch (e: any) {
      toast.error("Error en importación: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar base de datos</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con tus clientes o perros. Los clientes existentes
            (por email) se actualizan; los perros se vinculan a su dueño por <code>owner_email</code>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="dogs">Perros</TabsTrigger>
          </TabsList>

          <TabsContent value={mode} className="space-y-4 mt-4">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Columnas esperadas</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-1 mt-2">
                  {headers.map(h => (
                    <Badge key={h} variant="secondary" className="text-[10px] font-mono">{h}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {mode === "customers"
                    ? "Requeridos: first_name, last_name, email."
                    : "Requeridos: name, breed. Usa owner_email para vincular al dueño (se crea cliente automático si no existe). preferred_unit_name debe coincidir con el nombre exacto de una perrera ya creada en Instalaciones."}
                </p>
                {mode === "dogs" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <b>allergies</b> y <b>medications</b> aceptan varias entradas separadas por "<code>;</code>", cada una con sus partes separadas por "<code>:</code>": <br />
                    allergies → <code>alergeno:tipo:reaccion:severidad</code> (tipo: comida/ambiental/medicamento) <br />
                    medications → <code>nombre:dosis:frecuencia:via:con_comida</code> (via: oral/topica/inyectable)
                  </p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(mode)}>
                <Download className="h-4 w-4 mr-2" />
                Descargar plantilla CSV
              </Button>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="default" size="sm">
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Seleccionar archivo
                  </span>
                </Button>
              </label>
              {fileName && (
                <span className="text-sm text-muted-foreground self-center">
                  {fileName} · {rows.length} fila(s)
                </span>
              )}
            </div>

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo archivo...
              </div>
            )}

            {rows.length > 0 && !result && (
              <div className="border rounded-lg overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.slice(0, 6).map(h => <TableHead key={h}>{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        {headers.slice(0, 6).map(h => (
                          <TableCell key={h} className="text-xs">{r[h] || "—"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Vista previa de las primeras 5 filas
                  </p>
                )}
              </div>
            )}

            {result && (
              <Alert variant={result.errors.length > 0 ? "destructive" : "default"}>
                {result.errors.length > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <AlertTitle>Resultado</AlertTitle>
                <AlertDescription>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm">
                    <span><b>{result.created}</b> creados</span>
                    <span><b>{result.updated}</b> actualizados</span>
                    {result.linked > 0 && <span><b>{result.linked}</b> clientes auto-creados</span>}
                    <span><b>{result.errors.length}</b> con error</span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <div key={i}>Fila {e.row}: {e.reason}</div>
                      ))}
                      {result.errors.length > 20 && <div>... y {result.errors.length - 20} más</div>}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={rows.length === 0 || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {rows.length > 0 && `(${rows.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
