import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, Copy, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSendContract, type SendContractResult } from "@/hooks/queries/useContracts";

interface SendContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: { id: string; title: string; status: string; customerEmail: string | null } | null;
}

export function SendContractDialog({ open, onOpenChange, contract }: SendContractDialogProps) {
  const { organization } = useOrganization();
  const send = useSendContract();
  const [result, setResult] = useState<SendContractResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  if (!contract) return null;
  const orgEmail = organization?.email?.trim() || null;
  const resend = contract.status === "sent";

  const handleSend = async () => {
    try {
      const r = await send.mutateAsync(contract.id);
      setResult(r);
      if (r.emailed) toast.success("Contrato enviado para firma");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copy = async () => {
    if (!result?.signUrl) return;
    try {
      await navigator.clipboard.writeText(result.signUrl);
      setCopied(true);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; selecciona el enlace y cópialo a mano");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{resend ? "Reenviar para firma digital" : "Enviar para firma digital"}</DialogTitle>
          <DialogDescription>
            El cliente recibe un enlace personal para leer el contrato y firmarlo desde su celular.
            Al firmar, ambos reciben el PDF firmado.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{contract.title}</p>
            <ul className="space-y-2 rounded-lg border p-3">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground w-16 shrink-0">Para</span>
                <span className="truncate">{contract.customerEmail || "— el cliente no tiene correo"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground w-16 shrink-0">Copia</span>
                <span className="truncate">{orgEmail || "— el centro no tiene correo configurado"}</span>
              </li>
            </ul>
            {!orgEmail && (
              <p className="text-xs text-muted-foreground">
                Para recibir copia, agrega el correo del centro en Configuración → Perfil del negocio.
              </p>
            )}
            {resend && (
              <p className="text-xs text-muted-foreground">El enlace enviado antes deja de funcionar.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {result.emailed ? (
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Enviado a {result.sentTo?.join(" y ")}.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                <span>
                  No se pudo enviar el correo{result.error ? ` (${result.error})` : ""}. El enlace de firma sí quedó
                  listo: compártelo con el cliente por WhatsApp u otro medio.
                </span>
              </div>
            )}
            {result.signUrl && (
              <div className="flex gap-2">
                <Input readOnly value={result.signUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de firma" />
                <Button type="button" variant="outline" onClick={copy} aria-label="Copiar enlace">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSend} disabled={send.isPending || !contract.customerEmail}>
                {send.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {resend ? "Reenviar" : "Enviar"}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
