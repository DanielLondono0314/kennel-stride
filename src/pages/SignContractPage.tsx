import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Download, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { SignaturePad, type SignaturePadHandle } from "@/components/contracts/SignaturePad";
import { downloadContractPdf } from "@/hooks/queries/useContracts";
import { buildContractHtml } from "@/lib/contracts";

interface SigningView {
  title: string;
  body: string;
  status: "sent" | "signed";
  org: { name: string; email: string | null; phone: string | null };
  customerName: string;
  documentType: string;
  documentHint: string | null;
  dogs: string[];
  signedAt: string | null;
  signerName: string | null;
}

async function callSigning<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("contract-signing", { body });
  if (error) {
    let message = "No se pudo conectar. Inténtalo de nuevo.";
    try {
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.clone().json() : null;
      if (parsed?.error) message = parsed.error;
    } catch { /* respuesta sin JSON */ }
    throw new Error(message);
  }
  return data as T;
}

/** Página pública (sin cuenta) donde el cliente firma su contrato. */
export default function SignContractPage() {
  const { token = "" } = useParams<{ token: string }>();
  const padRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justSigned, setJustSigned] = useState<{ emailed: boolean } | null>(null);

  const view = useQuery({
    queryKey: ["contract-signing", token],
    retry: false,
    queryFn: async () => {
      const v = await callSigning<SigningView>({ action: "view", token });
      setName((n) => n || v.customerName);
      return v;
    },
  });

  const html = useMemo(() => (view.data ? buildContractHtml(view.data.body, null) : ""), [view.data]);

  const submit = async () => {
    setAttempted(true);
    const signature = padRef.current?.toDataUrl();
    if (name.trim().length < 5) return toast.error("Escribe tu nombre completo");
    if (!docNumber.trim()) return toast.error("Escribe tu número de documento");
    if (!signature) return toast.error("Dibuja tu firma en el recuadro");
    if (!accepted) return toast.error("Debes aceptar el contrato para firmarlo");
    setSubmitting(true);
    try {
      const r = await callSigning<{ emailed: boolean }>({
        action: "sign", token, name: name.trim(), document: docNumber.trim(), signature, accepted: true,
      });
      setJustSigned(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
      await view.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const download = async () => {
    if (!view.data) return;
    setDownloading(true);
    try {
      await downloadContractPdf({ token }, view.data.title);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const v = view.data;
  const signed = v?.status === "signed";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSignature className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{v?.org.name ?? "Firma de contrato"}</p>
            <p className="text-xs text-muted-foreground">Firma electrónica de contrato</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {view.isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : view.isError || !v ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-warning mb-3" />
              <h1 className="text-lg font-semibold mb-1">No se puede abrir este contrato</h1>
              <p className="text-sm text-muted-foreground max-w-sm">{(view.error as Error)?.message ?? "Enlace no válido."}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {signed ? (
              <Card className="border-primary/40">
                <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                    <div>
                      <h1 className="font-semibold">Contrato firmado</h1>
                      <p className="text-sm text-muted-foreground">
                        {v.signerName} firmó el {v.signedAt ? format(parseISO(v.signedAt), "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es }) : ""}.
                        {justSigned && (justSigned.emailed
                          ? " Te enviamos una copia en PDF a tu correo; el centro también la recibió."
                          : " Descarga tu copia en PDF.")}
                      </p>
                    </div>
                  </div>
                  <Button onClick={download} disabled={downloading} className="shrink-0">
                    {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Descargar PDF
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div>
                <h1 className="text-xl font-bold">{v.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Hola {v.customerName.split(" ")[0]}, lee el contrato{v.dogs.length ? ` de ${v.dogs.join(", ")}` : ""} y fírmalo al final.
                </p>
              </div>
            )}

            <ContractDocument html={html} />

            {!signed && (
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <h2 className="font-semibold">Firmar</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-name">Nombre completo</Label>
                      <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                        aria-invalid={attempted && name.trim().length < 5} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-doc">Número de documento ({v.documentType})</Label>
                      <Input id="s-doc" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} inputMode="numeric" autoComplete="off"
                        aria-invalid={attempted && !docNumber.trim()} aria-describedby="s-doc-hint" />
                      {v.documentHint && (
                        <p id="s-doc-hint" className="text-xs text-muted-foreground">Debe coincidir con el registrado en el centro (termina en {v.documentHint}).</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tu firma</Label>
                    <SignaturePad ref={padRef} onChange={setHasSignature} invalid={attempted && !hasSignature} />
                  </div>

                  <label className="flex items-start gap-3 text-sm leading-relaxed">
                    <Checkbox checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} className="mt-0.5"
                      aria-invalid={attempted && !accepted} />
                    <span>
                      Leí y acepto este contrato, y acepto firmarlo electrónicamente. Entiendo que esta firma tiene la misma
                      validez que mi firma manuscrita (Ley 527 de 1999) y que se registrarán la fecha, hora y dirección IP.
                    </span>
                  </label>

                  <Button onClick={submit} disabled={submitting} size="lg" className="w-full sm:w-auto">
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
                    Firmar contrato
                  </Button>
                  {v.org.email && (
                    <p className="text-xs text-muted-foreground">¿Algo no está bien? Escribe a {v.org.email}{v.org.phone ? ` o llama al ${v.org.phone}` : ""} antes de firmar.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
