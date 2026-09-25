import { useState, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
import {
  type RawRow, normalizeRow, decodeCsvBytes, toIsoDate, parseImportDate, isDescriptionRow,
  looksLikeEmail, parseBool, parseDecimal, digitsOnly, parseAllergies, parseMedications,
} from "@/lib/importParsing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "customers" | "dogs";
  onImported?: () => void;
}

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
// entrada con sus partes separadas por ":". Se documenta en el modal
// (parseo en src/lib/importParsing.ts).
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

function isExcelFile(file: File): boolean {
  return (
    /\.xlsx?$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

// Lee la primera hoja de un .xlsx/.xls y la devuelve como filas planas. Las
// celdas de fecha se convierten a aaaa-mm-dd desde su valor real: el texto
// formateado depende del formato de celda (p. ej. "5/10/26" en mm-dd-yy) y
// es ambiguo.
async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: "array", cellNF: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith("!")) continue;
    const cell = sheet[addr] as XLSX.CellObject;
    if (cell.t === "n" && typeof cell.v === "number" && cell.z && XLSX.SSF.is_date(cell.z)) {
      const p = XLSX.SSF.parse_date_code(cell.v);
      const iso = toIsoDate(p.y, p.m, p.d);
      sheet[addr] = { t: "s", v: iso, w: iso };
    }
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

// CSV: se decodifica a mano para soportar los CSV Windows-1252 de Excel.
async function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; warnings: number }> {
  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
  return { rows: res.data, warnings: res.errors.length };
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

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    const excel = isExcelFile(file);
    try {
      let data: Record<string, unknown>[];
      let warnings = 0;
      if (excel) {
        data = await parseExcelFile(file);
      } else {
        ({ rows: data, warnings } = await parseCsvFile(file));
      }
      const normalized = data.map(normalizeRow);
      setRows(normalized);
      setFileName(file.name);
      if (warnings > 0) toast.warning(`Archivo cargado con ${warnings} advertencias`);
      else toast.success(`${normalized.length} fila(s) leída(s)`);
    } catch (err) {
      toast.error(`Error al leer ${excel ? "Excel" : "CSV"}: ` + (err instanceof Error ? err.message : String(err)));
    } finally {
      setParsing(false);
    }
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
      if (isDescriptionRow(r)) {
        out.skipped++;
        continue;
      }
      if (!r.first_name || !r.last_name || !r.email) {
        out.errors.push({ row: i + 2, reason: "Faltan campos requeridos (first_name, last_name, email)" });
        continue;
      }
      if (!looksLikeEmail(r.email)) {
        out.errors.push({ row: i + 2, reason: `Email "${r.email}" no es válido` });
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
      // Un dueño con varios perros suele venir repetido (una fila por perro):
      // la primera fila lo crea y las siguientes lo actualizan.
      const existingId = existingMap.get(payload.email);
      if (existingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", existingId);
        if (error) out.errors.push({ row: i + 2, reason: error.message });
        else out.updated++;
      } else {
        const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
        if (error || !created) out.errors.push({ row: i + 2, reason: error?.message ?? "No se pudo crear el cliente" });
        else {
          existingMap.set(payload.email, created.id);
          out.created++;
        }
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
    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const c of customers ?? []) {
      const email = c.email.toLowerCase();
      if (!byEmail.has(email)) byEmail.set(email, c.id);
      const phone = digitsOnly(c.phone);
      if (phone && !byPhone.has(phone)) byPhone.set(phone, c.id);
    }
    const emailById = new Map<string, string>((customers ?? []).map(c => [c.id, c.email.toLowerCase()] as [string, string]));

    // Perros existentes, para que reimportar el mismo archivo actualice en vez
    // de duplicar. Se identifican por microchip o por (email del dueño, nombre).
    const { data: existingDogs } = await supabase
      .from("dogs")
      .select("id, name, customer_id, microchip_number")
      .eq("organization_id", organization.id);
    const dogKey = (ownerEmail: string, name: string) => `${ownerEmail}|${name.trim().toLowerCase()}`;
    const dogByChip = new Map<string, string>();
    const dogByOwnerName = new Map<string, string>();
    for (const d of existingDogs ?? []) {
      const chip = digitsOnly(d.microchip_number ?? "");
      if (chip) dogByChip.set(chip, d.id);
      const ownerEmail = emailById.get(d.customer_id);
      if (ownerEmail) dogByOwnerName.set(dogKey(ownerEmail, d.name), d.id);
    }

    // Perreras de la org, para resolver preferred_unit_name -> preferred_unit_id
    const { data: units } = await supabase
      .from("facility_units")
      .select("id, name")
      .eq("organization_id", organization.id);
    const unitByName = new Map<string, string>((units ?? []).map(u => [u.name.toLowerCase(), u.id] as [string, string]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (isDescriptionRow(r)) {
        out.skipped++;
        continue;
      }
      if (!r.name || !r.breed) {
        out.errors.push({ row: i + 2, reason: "Faltan campos requeridos (name, breed)" });
        continue;
      }

      // Resolve customer
      let customerId: string | undefined;
      if (r.owner_email) customerId = byEmail.get(r.owner_email.toLowerCase());
      if (!customerId && r.owner_phone) customerId = byPhone.get(digitsOnly(r.owner_phone));

      if (!customerId && r.owner_email && !looksLikeEmail(r.owner_email)) {
        out.errors.push({ row: i + 2, reason: `owner_email "${r.owner_email}" no es un email válido` });
        continue;
      }

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

      // Una fecha mala no debe dejar al perro fuera: se crea sin fecha y se avisa.
      const birth = parseImportDate(r.birth_date);
      if (birth.error) {
        out.errors.push({ row: i + 2, reason: `${birth.error} — el perro se importó sin fecha de nacimiento` });
      }

      const payload = {
        organization_id: organization.id,
        customer_id: customerId,
        name: r.name,
        breed: r.breed,
        gender: ["female", "hembra", "f"].includes(r.gender?.toLowerCase()) ? "female" : "male",
        birth_date: birth.value,
        weight: parseDecimal(r.weight),
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
      const chip = digitsOnly(payload.microchip_number ?? "");
      const ownerKey = dogKey(emailById.get(customerId) ?? r.owner_email.toLowerCase(), payload.name);
      const existingDogId = (chip && dogByChip.get(chip)) || dogByOwnerName.get(ownerKey);

      let dogId: string;
      if (existingDogId) {
        const { error } = await supabase.from("dogs").update(payload).eq("id", existingDogId);
        if (error) {
          out.errors.push({ row: i + 2, reason: error.message });
          continue;
        }
        dogId = existingDogId;
      } else {
        const { data: newDog, error } = await supabase.from("dogs").insert(payload).select("id").single();
        if (error || !newDog) {
          out.errors.push({ row: i + 2, reason: error?.message ?? "No se pudo crear el perro" });
          continue;
        }
        dogId = newDog.id;
      }
      if (chip) dogByChip.set(chip, dogId);
      dogByOwnerName.set(ownerKey, dogId);

      // En una actualización solo se agregan alergias/medicamentos que el perro aún no tenga.
      let newAllergies = allergyEntries;
      let newMedications = medicationEntries;
      if (existingDogId && (allergyEntries.length > 0 || medicationEntries.length > 0)) {
        const [{ data: curAllergies }, { data: curMeds }] = await Promise.all([
          supabase.from("dog_allergies").select("allergen").eq("dog_id", dogId),
          supabase.from("dog_medications").select("name").eq("dog_id", dogId),
        ]);
        const haveA = new Set((curAllergies ?? []).map((a) => a.allergen.toLowerCase()));
        const haveM = new Set((curMeds ?? []).map((m) => m.name.toLowerCase()));
        newAllergies = allergyEntries.filter((a) => !haveA.has(a.allergen.toLowerCase()));
        newMedications = medicationEntries.filter((m) => !haveM.has(m.name.toLowerCase()));
      }

      if (newAllergies.length > 0) {
        const { error: allergyErr } = await supabase.from("dog_allergies").insert(
          newAllergies.map((a) => ({ ...a, dog_id: dogId, organization_id: organization.id }))
        );
        if (allergyErr) out.errors.push({ row: i + 2, reason: "Perro guardado, pero fallaron sus alergias: " + allergyErr.message });
      }
      if (newMedications.length > 0) {
        const { error: medErr } = await supabase.from("dog_medications").insert(
          newMedications.map((m) => ({ ...m, dog_id: dogId, organization_id: organization.id }))
        );
        if (medErr) out.errors.push({ row: i + 2, reason: "Perro guardado, pero fallaron sus medicamentos: " + medErr.message });
      }

      if (existingDogId) out.updated++;
      else out.created++;
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
            Sube un archivo CSV o Excel (.xlsx/.xls) con tus clientes o perros. Los clientes existentes
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
                Descargar plantilla CSV (con ejemplo)
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={mode === "customers" ? "/templates/plantilla_clientes.xlsx" : "/templates/plantilla_perros.xlsx"} download>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Descargar plantilla Excel (vacía)
                </a>
              </Button>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
                    Seleccionar archivo (CSV o Excel)
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
                    {result.skipped > 0 && <span><b>{result.skipped}</b> fila(s) de descripción omitida(s)</span>}
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
