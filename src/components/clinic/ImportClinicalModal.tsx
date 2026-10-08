import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { readImportSheets } from "@/lib/importFiles";
import {
  CLINICAL_TEMPLATES, KIND_LABELS, KIND_ORDER, buildDogIndex, detectKind, dropRepeatedAcrossFiles, dropWeightsInConsultations, parseClinicalRows,
  type ClinicalKind, type ClinicalRecord, type OrgDog, type ParsedClinicalFile, type RowIssue,
} from "@/lib/clinicalImport";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tras importar: refrescar lo que esté abierto. */
  onImported?: () => void;
}

interface Sheet {
  id: string;
  name: string;
  rows: Record<string, unknown>[];
  /** null = no se importa (hoja no reconocida o descartada). */
  kind: ClinicalKind | null;
}

interface Counts { inserted: number; duplicates: number; invalid_dogs: number }

const CHUNK = 500;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const SKIP = "skip";

function downloadTemplate(kind: ClinicalKind) {
  const t = CLINICAL_TEMPLATES[kind];
  const url = URL.createObjectURL(new Blob(["﻿" + t.csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = t.file;
  a.click();
  URL.revokeObjectURL(url);
}

async function callImport(orgId: string, kind: ClinicalKind, records: ClinicalRecord[], dryRun: boolean): Promise<Counts> {
  const total: Counts = { inserted: 0, duplicates: 0, invalid_dogs: 0 };
  for (let i = 0; i < records.length; i += CHUNK) {
    const { data, error } = await supabase.rpc("import_clinical_records", {
      p_org_id: orgId,
      p_kind: kind,
      p_rows: records.slice(i, i + CHUNK).map((r) => r.data),
      p_dry_run: dryRun,
    });
    if (error) throw error;
    const c = data as unknown as Counts;
    total.inserted += c.inserted;
    total.duplicates += c.duplicates;
    total.invalid_dogs += c.invalid_dogs;
  }
  return total;
}

/**
 * Importa historia clínica de otra plataforma: consultas, vacunas,
 * desparasitaciones y pesos, desde CSV o Excel (todas las hojas). Las filas
 * de perros que no están en el centro se ignoran y lo ya importado no se duplica.
 */
export function ImportClinicalModal({ open, onOpenChange, onImported }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Record<string, Counts | "error">>({});
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, Counts> | null>(null);

  const { data: dogs = [], isLoading: loadingDogs } = useQuery({
    queryKey: ["clinical-import-dogs", orgId],
    enabled: open && !!orgId,
    queryFn: async (): Promise<OrgDog[]> => {
      const { data, error } = await supabase
        .from("dogs")
        .select("id, name, microchip_number, customers(first_name, last_name, phone)")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []).map((d) => {
        const c = d.customers as { first_name: string; last_name: string; phone: string | null } | null;
        return {
          id: d.id,
          name: d.name,
          microchip_number: d.microchip_number,
          owner_name: c ? `${c.first_name} ${c.last_name}` : null,
          owner_phone: c?.phone ?? null,
        };
      });
    },
  });
  const index = useMemo(() => buildDogIndex(dogs), [dogs]);

  // Lectura de cada hoja con su tipo; los pesos que ya vienen en una consulta se quitan.
  const parsed = useMemo(() => {
    const out = new Map<string, ParsedClinicalFile & { droppedWeights: number; repeated: number }>();
    if (!dogs.length) return out;
    for (const s of sheets) if (s.kind) out.set(s.id, { ...parseClinicalRows(s.rows, s.kind, index), droppedWeights: 0, repeated: 0 });
    const files = [...out.values()];
    dropRepeatedAcrossFiles(files).forEach((n, i) => { files[i].repeated = n; });
    const medical = [...out.values()].filter((p) => p.kind === "medical").flatMap((p) => p.records);
    for (const p of out.values()) {
      if (p.kind !== "weights") continue;
      const { kept, dropped } = dropWeightsInConsultations(p.records, medical);
      p.records = kept;
      p.droppedWeights = dropped;
    }
    return out;
  }, [sheets, index, dogs.length]);

  // Vista previa en el servidor (sin escribir): nuevos vs. ya existentes.
  useEffect(() => {
    if (!orgId || result || parsed.size === 0) return;
    let cancelled = false;
    setPreviewing(true);
    (async () => {
      const next: Record<string, Counts | "error"> = {};
      for (const [id, p] of parsed) {
        try {
          next[id] = p.records.length ? await callImport(orgId, p.kind, p.records, true) : { inserted: 0, duplicates: 0, invalid_dogs: 0 };
        } catch {
          next[id] = "error";
        }
      }
      if (!cancelled) {
        setPreview(next);
        setPreviewing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parsed, orgId, result]);

  function reset() {
    setSheets([]);
    setPreview({});
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close(o: boolean) {
    if (importing) return;
    if (!o) reset();
    onOpenChange(o);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setResult(null);
    try {
      const added: Sheet[] = [];
      for (const f of Array.from(files)) {
        try {
          for (const s of await readImportSheets(f)) {
            added.push({ id: `${s.name}-${crypto.randomUUID()}`, name: s.name, rows: s.rows, kind: detectKind(Object.keys(s.rows[0] ?? {}), s.name) });
          }
        } catch {
          toast.error(`No se pudo leer ${f.name}`, { description: "Usa archivos CSV o Excel (.xlsx)." });
        }
      }
      setSheets((prev) => [...prev, ...added]);
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const toImport = [...parsed.entries()].filter(([, p]) => p.records.length > 0);
  const newTotal = toImport.reduce((s, [id]) => s + (typeof preview[id] === "object" ? (preview[id] as Counts).inserted : 0), 0);

  async function runImport() {
    if (!orgId) return;
    setImporting(true);
    const done: Record<string, Counts> = {};
    try {
      for (const kind of KIND_ORDER) {
        for (const [id, p] of toImport) {
          if (p.kind !== kind) continue;
          done[id] = await callImport(orgId, kind, p.records, false);
        }
      }
      setResult(done);
      const inserted = Object.values(done).reduce((s, c) => s + c.inserted, 0);
      toast.success(`Historia clínica importada: ${inserted} registros nuevos`);
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && /weight|dashboard|welfare|clinic|vaccin|deworm|medical/i.test(q.queryKey[0] as string) });
      onImported?.();
    } catch (e) {
      setResult(Object.keys(done).length ? done : null);
      toast.error("La importación se detuvo", {
        description: `${e instanceof Error ? e.message : "Error inesperado"}. Lo importado se conserva; vuelve a importar y no se duplicará.`,
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden /> Importar historia clínica
          </DialogTitle>
          <DialogDescription>
            Trae consultas, vacunas, desparasitaciones y pesos desde otra plataforma (CSV o Excel). Se emparejan con
            los perros del centro por id, microchip o nombre y dueño; las filas de perros que no están registrados se ignoran.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <div
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm">Arrastra los archivos aquí o</p>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={reading || importing}>
                {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Elegir archivos"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">Puedes subir varios a la vez; en Excel se lee cada hoja.</p>
            </div>
          )}

          {sheets.length === 0 && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">¿Qué columnas reconoce?</p>
              <p className="text-muted-foreground">
                Las de Tails Up o sus equivalentes en español (fecha, paciente/mascota, propietario, motivo, diagnóstico,
                tratamiento, fórmula, peso, temperatura, vacuna, lote, producto, próxima dosis…). Descarga una plantilla de ejemplo:
              </p>
              <div className="flex flex-wrap gap-2">
                {KIND_ORDER.map((k) => (
                  <Button key={k} variant="ghost" size="sm" className="gap-1.5" onClick={() => downloadTemplate(k)}>
                    <Download className="h-3.5 w-3.5" /> {KIND_LABELS[k]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {loadingDogs && sheets.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando los perros del centro…</p>
          )}

          {sheets.map((s) => {
            const p = parsed.get(s.id);
            const pv = preview[s.id];
            const done = result?.[s.id];
            return (
              <div key={s.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium" title={s.name}>{s.name}</p>
                  <span className="text-xs text-muted-foreground">{plural(s.rows.length, "fila", "filas")}</span>
                  <Select
                    value={s.kind ?? SKIP}
                    onValueChange={(v) => setSheets((prev) => prev.map((x) => (x.id === s.id ? { ...x, kind: v === SKIP ? null : (v as ClinicalKind) } : x)))}
                    disabled={importing || !!result}
                  >
                    <SelectTrigger className="h-8 w-56" aria-label={`Tipo de registros de ${s.name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KIND_ORDER.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}
                      <SelectItem value={SKIP}>No importar</SelectItem>
                    </SelectContent>
                  </Select>
                  {!result && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quitar ${s.name}`} disabled={importing}
                      onClick={() => setSheets((prev) => prev.filter((x) => x.id !== s.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {!s.kind ? (
                  <p className="text-xs text-muted-foreground">No se reconoció como historia clínica; elige el tipo si quieres importarla.</p>
                ) : p ? (
                  <>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {done ? (
                        <>
                          <Badge className="border-0 bg-success/10 text-success">{plural(done.inserted, "importado", "importados")}</Badge>
                          {done.duplicates > 0 && <Badge variant="secondary">{plural(done.duplicates, "ya existía", "ya existían")}</Badge>}
                        </>
                      ) : (
                        <>
                          <Badge className="border-0 bg-primary/10 text-primary">{p.records.length} con perro</Badge>
                          {pv === "error" ? (
                            <Badge variant="destructive">No se pudo revisar</Badge>
                          ) : pv ? (
                            <>
                              <Badge className="border-0 bg-success/10 text-success">{plural(pv.inserted, "nuevo", "nuevos")}</Badge>
                              {pv.duplicates > 0 && <Badge variant="secondary">{plural(pv.duplicates, "ya existía", "ya existían")}</Badge>}
                            </>
                          ) : previewing && p.records.length > 0 ? (
                            <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Revisando</Badge>
                          ) : null}
                        </>
                      )}
                      {p.droppedWeights > 0 && <Badge variant="secondary">{p.droppedWeights} pesos ya vienen en consultas</Badge>}
                      {p.repeated > 0 && <Badge variant="secondary">{p.repeated} repetidos de otro archivo</Badge>}
                      {p.noDog.length > 0 && <Badge variant="outline">{p.noDog.length} sin perro en el centro (se {p.noDog.length === 1 ? "ignora" : "ignoran"})</Badge>}
                      {p.errors.length > 0 && <Badge variant="destructive">{p.errors.length} con errores</Badge>}
                      {p.warnings.length > 0 && <Badge className="border-0 bg-warning/15 text-warning">{plural(p.warnings.length, "aviso", "avisos")}</Badge>}
                    </div>
                    <IssueList title="Sin perro en el centro (se ignoran)" items={p.noDog} />
                    <IssueList title="Con errores (no se importan)" items={p.errors} tone="error" />
                    <IssueList title="Avisos (se importan con el dato corregido)" items={p.warnings} />
                  </>
                ) : null}
              </div>
            );
          })}

          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Listo. Cada registro quedó en la ficha clínica de su perro. Si vuelves a importar los mismos archivos no se duplica nada.
              </AlertDescription>
            </Alert>
          )}
          {!result && sheets.length > 0 && toImport.length === 0 && !loadingDogs && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No hay filas para importar: revisa el tipo de cada archivo o que los perros estén registrados.</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {result ? (
            <Button onClick={() => close(false)}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={runImport} disabled={importing || previewing || toImport.length === 0 || newTotal === 0} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? "Importando…" : newTotal > 0 ? `Importar ${plural(newTotal, "registro", "registros")}` : sheets.length ? "Nada nuevo para importar" : "Importar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueList({ title, items, tone }: { title: string; items: RowIssue[]; tone?: "error" }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-md bg-muted/40 px-3 py-2 text-xs">
      <summary className={cn("cursor-pointer font-medium", tone === "error" && "text-destructive")}>
        {title} ({items.length})
      </summary>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {items.slice(0, 200).map((it, i) => (
          <li key={i}>
            <span className="tabular-nums text-muted-foreground">Fila {it.row}</span> · <span className="font-medium">{it.dogName}</span> — {it.reason}
          </li>
        ))}
        {items.length > 200 && <li className="text-muted-foreground">…y {items.length - 200} más</li>}
      </ul>
    </details>
  );
}
