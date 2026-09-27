import { useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, Download, Loader2, MoreHorizontal, Printer, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermission } from "@/hooks/usePermission";
import {
  downloadContractPdf, useDeleteContract, useSetContractStatus, type ContractRow,
} from "@/hooks/queries/useContracts";
import { buildContractHtml, defaultSignatures, printContract } from "@/lib/contracts";
import { SendContractDialog } from "./SendContractDialog";

/** Imprimir, PDF, enviar para firma, marcar firmado, anular y eliminar. */
export function ContractActions({ contract: c }: { contract: ContractRow }) {
  const { organization } = useOrganization();
  const isAdmin = usePermission("manage_settings");
  const setStatus = useSetContractStatus();
  const deleteContract = useDeleteContract();
  const [sendOpen, setSendOpen] = useState(false);
  const [confirm, setConfirm] = useState<"void" | "delete" | null>(null);
  const [downloading, setDownloading] = useState(false);

  const digitallySigned = c.status === "signed" && c.signed_via === "digital";
  const canSend = c.status === "generated" || c.status === "sent";

  const print = () => {
    const values = (c.field_values ?? {}) as Record<string, string>;
    const customerName = c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "";
    const signatures = c.include_signatures
      ? defaultSignatures({
          ...values,
          negocio_nombre: values.negocio_nombre || organization?.name || "",
          cliente_nombre: values.cliente_nombre || customerName,
        })
      : null;
    printContract(c.title, buildContractHtml(c.body, signatures));
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadContractPdf({ contractId: c.id }, c.title);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const markSigned = async () => {
    try {
      await setStatus.mutateAsync({ id: c.id, status: "signed" });
      toast.success("Contrato marcado como firmado en papel");
    } catch {
      toast.error("No se pudo actualizar el contrato");
    }
  };

  const runConfirm = async () => {
    try {
      if (confirm === "void") {
        await setStatus.mutateAsync({ id: c.id, status: "void" });
        toast.success("Contrato anulado");
      } else if (confirm === "delete") {
        await deleteContract.mutateAsync(c.id);
        toast.success("Contrato eliminado");
      }
    } catch {
      toast.error("No se pudo completar la acción");
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {digitallySigned ? (
        <Button variant="ghost" size="icon" onClick={download} disabled={downloading} aria-label="Descargar PDF firmado">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={print} aria-label="Imprimir contrato">
          <Printer className="h-4 w-4" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canSend && (
            <DropdownMenuItem onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4 mr-2" /> {c.status === "sent" ? "Reenviar para firma digital" : "Enviar para firma digital"}
            </DropdownMenuItem>
          )}
          {digitallySigned && (
            <DropdownMenuItem onClick={print}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir sin firma
            </DropdownMenuItem>
          )}
          {!digitallySigned && (
            <DropdownMenuItem onClick={download}>
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </DropdownMenuItem>
          )}
          {canSend && (
            <DropdownMenuItem onClick={markSigned}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar firmado en papel
            </DropdownMenuItem>
          )}
          {c.status !== "void" && (
            <DropdownMenuItem onClick={() => setConfirm("void")}>
              <Ban className="h-4 w-4 mr-2" /> Anular
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirm("delete")}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SendContractDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        contract={{ id: c.id, title: c.title, status: c.status, customerEmail: c.customers?.email ?? null }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "void" ? "¿Anular este contrato?" : "¿Eliminar este contrato?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "void"
                ? "Queda en el historial como anulado y el enlace de firma deja de funcionar."
                : "Se borra del historial y de los perfiles de los perros de forma permanente. Si ya se firmó, es mejor anularlo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
