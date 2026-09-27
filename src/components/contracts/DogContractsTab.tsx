import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { FileSignature, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { usePermission } from "@/hooks/usePermission";
import { contractDogNames, useDogContracts } from "@/hooks/queries/useContracts";
import { CONTRACT_STATUS, formatContractValue } from "@/lib/contracts";
import { ContractActions } from "./ContractActions";

function short(date: string | null) {
  return date ? format(parseISO(date), "d MMM yyyy", { locale: es }) : "";
}

/** Contratos anexados a un perro, en su perfil. */
export function DogContractsTab({ dogId, dogName, customerId }: { dogId: string; dogName: string; customerId: string }) {
  const navigate = useOrgNavigate();
  const canSchedule = usePermission("schedule");
  const canBill = usePermission("billing");
  const { data, isLoading, isError, refetch } = useDogContracts(dogId);

  if (!canSchedule && !canBill) {
    return <EmptyState icon={FileSignature} title="Sin acceso a contratos" description="Tu rol necesita el permiso de agendar o de cobrar." />;
  }

  const newContract = () => navigate(`/contracts/new?customer=${customerId}&dog=${dogId}`);

  if (isError) return <QueryErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableSkeleton rows={3} columns={3} />;

  const contracts = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {contracts.length === 0 ? `${dogName} no tiene contratos.` : `${contracts.length} ${contracts.length === 1 ? "contrato" : "contratos"}`}
        </p>
        <Button variant="outline" size="sm" onClick={newContract}>
          <Plus className="h-4 w-4 mr-2" /> Generar contrato
        </Button>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title="Sin contratos"
            description="Los contratos que generes para este perro aparecerán aquí, con su estado de firma."
          />
        </Card>
      ) : (
        contracts.map((c) => {
          const others = contractDogNames(c).filter((n) => n !== dogName);
          const status = CONTRACT_STATUS[c.status];
          return (
            <Card key={c.id} className={c.status === "void" ? "opacity-60" : undefined}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-sm">{c.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {c.status === "signed" && (
                        <span>
                          {c.signed_via === "digital" ? "Firma digital" : "En papel"}
                          {c.signed_at && ` · ${short(c.signed_at)}`}
                        </span>
                      )}
                      {c.status === "sent" && c.sent_at && <span>Enviado el {short(c.sent_at)}</span>}
                      {c.start_date && <span>{short(c.start_date)} – {short(c.end_date)}</span>}
                      {c.total_value != null && <span>{formatContractValue(c.total_value)}</span>}
                    </div>
                    {others.length > 0 && (
                      <p className="text-xs text-muted-foreground">También cubre a {others.join(", ")}</p>
                    )}
                  </div>
                  <ContractActions contract={c} />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
