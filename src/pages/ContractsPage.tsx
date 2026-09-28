import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, MoreHorizontal, Trash2, Pencil, Copy, FileText, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { TemplateEditorDialog } from "@/components/contracts/TemplateEditorDialog";
import { ContractActions } from "@/components/contracts/ContractActions";
import { useUrlState } from "@/hooks/useUrlState";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { usePermission } from "@/hooks/usePermission";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import {
  contractDogNames, useContracts, useContractTemplates, useDeleteContractTemplate,
  useSaveContractTemplate, type ContractStatus, type ContractTemplate,
} from "@/hooks/queries/useContracts";
import { CONTRACT_STATUS, formatContractValue } from "@/lib/contracts";

function formatShort(date: string | null) {
  if (!date) return "—";
  return format(parseISO(date), "d MMM yyyy", { locale: es });
}

export default function ContractsPage() {
  const navigate = useOrgNavigate();
  const { labels: serviceLabels } = useServiceTypes();
  const canSchedule = usePermission("schedule");
  const canBill = usePermission("billing");
  const isAdmin = usePermission("manage_settings");
  const canUse = canSchedule || canBill;

  const [tab, setTab] = useUrlState<string>("tab", "contracts");
  const [search, setSearch] = useState("");
  // ?contract=<id>: enlace directo a un contrato (p. ej. desde el detalle de una reserva).
  const [contractParam, setContractParam] = useUrlState<string>("contract", "", { replace: true });
  const [statusFilter, setStatusFilter] = useState<"all" | ContractStatus>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContractTemplate | null>(null);

  const contractsQuery = useContracts();
  const templatesQuery = useContractTemplates();
  const deleteTemplate = useDeleteContractTemplate();
  const saveTemplate = useSaveContractTemplate();

  const contracts = useMemo(() => contractsQuery.data ?? [], [contractsQuery.data]);
  const templates = templatesQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (contractParam) return c.id === contractParam;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const customer = c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "";
      return [customer, c.title, ...contractDogNames(c)].some((s) => s.toLowerCase().includes(q));
    });
  }, [contracts, search, statusFilter, contractParam]);

  const pendingCount = contracts.filter((c) => c.status === "generated" || c.status === "sent").length;

  if (!canUse) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Sin acceso a contratos"
        description="Tu rol necesita el permiso de agendar o de cobrar para ver y generar contratos."
      />
    );
  }

  const runDeleteTemplate = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTemplate.mutateAsync(confirmDelete.id);
      toast.success("Plantilla eliminada", { description: "Los contratos ya generados con ella se conservan." });
    } catch {
      toast.error("No se pudo eliminar la plantilla");
    } finally {
      setConfirmDelete(null);
    }
  };

  const duplicateTemplate = async (t: ContractTemplate) => {
    try {
      await saveTemplate.mutateAsync({
        name: `${t.name} (copia)`.slice(0, 80),
        service_type: t.service_type,
        body: t.body,
        include_signatures: t.include_signatures,
      });
      toast.success("Plantilla duplicada");
    } catch {
      toast.error("No se pudo duplicar la plantilla");
    }
  };

  const openEditor = (t: ContractTemplate | null) => {
    setEditing(t);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">Documentación legal de cada servicio: imprime o envía para firma digital</p>
        </div>
        <Button
          onClick={() => navigate("/contracts/new")}
          disabled={templates.length === 0}
          className="bg-accent text-accent-foreground hover:bg-accent/90 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generar contrato
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contracts">
            Contratos
            {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        {/* ── Contratos generados ── */}
        <TabsContent value="contracts" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, perro o contrato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="generated">Pendientes de firma</SelectItem>
                <SelectItem value="sent">Enviados para firma</SelectItem>
                <SelectItem value="signed">Firmados</SelectItem>
                <SelectItem value="void">Anulados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {contractsQuery.isError ? (
                <QueryErrorState onRetry={() => contractsQuery.refetch()} />
              ) : contractsQuery.isLoading ? (
                <div className="p-4"><TableSkeleton rows={5} columns={6} /></div>
              ) : filtered.length === 0 && contractParam ? (
                <EmptyState
                  icon={FileSignature}
                  title="Contrato no encontrado"
                  description="El contrato enlazado no existe o fue eliminado."
                  action={<Button variant="outline" onClick={() => setContractParam("")}>Ver todos los contratos</Button>}
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={FileSignature}
                  title={contracts.length === 0 ? "Aún no hay contratos" : "Sin resultados"}
                  description={
                    contracts.length === 0
                      ? templates.length === 0
                        ? "Primero crea una plantilla por cada tipo de servicio que ofreces."
                        : "Genera el primero: eliges la plantilla, el cliente y el sistema llena el resto."
                      : "Prueba con otra búsqueda o filtro."
                  }
                  action={
                    contracts.length === 0 && (
                      templates.length === 0 ? (
                        isAdmin && (
                          <Button variant="outline" onClick={() => { setTab("templates"); openEditor(null); }}>
                            <Plus className="h-4 w-4 mr-2" /> Crear plantilla
                          </Button>
                        )
                      ) : (
                        <Button variant="outline" onClick={() => navigate("/contracts/new")}>
                          <Plus className="h-4 w-4 mr-2" /> Generar contrato
                        </Button>
                      )
                    )
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractParam && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/40 text-sm">
                          Mostrando el contrato enlazado.{" "}
                          <button type="button" onClick={() => setContractParam("")} className="font-medium text-primary underline underline-offset-2">
                            Ver todos
                          </button>
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((c) => (
                      <TableRow key={c.id} className={c.status === "void" ? "opacity-60" : undefined}>
                        <TableCell>
                          <div className="font-medium">
                            {c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "—"}
                          </div>
                          {c.contract_dogs.length > 0 && (
                            <div className="text-xs text-muted-foreground">{contractDogNames(c).join(", ")}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{c.title}</div>
                          {c.service_type && (
                            <div className="text-xs text-muted-foreground">{serviceLabels[c.service_type] ?? c.service_type}</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {c.start_date ? `${formatShort(c.start_date)} – ${formatShort(c.end_date)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatContractValue(c.total_value) || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={CONTRACT_STATUS[c.status].variant}>{CONTRACT_STATUS[c.status].label}</Badge>
                          {c.status === "signed" && c.signed_via && (
                            <div className="text-xs text-muted-foreground mt-1">{c.signed_via === "digital" ? "Firma digital" : "En papel"}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatShort(c.created_at)}</TableCell>
                        <TableCell><ContractActions contract={c} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plantillas ── */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Una plantilla por tipo de contrato (guardería, internado, domicilio…).
              {!isAdmin && " Solo un administrador puede crearlas o editarlas."}
            </p>
            {isAdmin && (
              <Button variant="outline" onClick={() => openEditor(null)} className="self-start sm:self-auto">
                <Plus className="h-4 w-4 mr-2" /> Nueva plantilla
              </Button>
            )}
          </div>

          {templatesQuery.isError ? (
            <QueryErrorState onRetry={() => templatesQuery.refetch()} />
          ) : templatesQuery.isLoading ? (
            <TableSkeleton rows={3} columns={3} />
          ) : templates.length === 0 ? (
            <Card>
              <EmptyState
                icon={FileText}
                title="No hay plantillas"
                description="Importa tu contrato en Word o parte de uno de nuestros ejemplos, y marca los datos que cambian por cliente."
                action={isAdmin && (
                  <Button variant="outline" onClick={() => openEditor(null)}>
                    <Plus className="h-4 w-4 mr-2" /> Crear plantilla
                  </Button>
                )}
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((t) => {
                const used = contracts.filter((c) => c.template_id === t.id).length;
                return (
                  <Card key={t.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{t.name}</CardTitle>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="-mt-1 -mr-2 h-8 w-8" aria-label="Acciones de plantilla">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditor(t)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateTemplate(t)}>
                                <Copy className="h-4 w-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setConfirmDelete(t)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <CardDescription>
                        {t.service_type ? serviceLabels[t.service_type] ?? t.service_type : "Cualquier servicio"}
                        {" · "}
                        {used} {used === 1 ? "contrato" : "contratos"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="line-clamp-4 text-sm text-muted-foreground whitespace-pre-line">
                        {t.body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").slice(0, 300)}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" variant="secondary" onClick={() => navigate(`/contracts/new?template=${t.id}`)}>
                        <FileSignature className="h-4 w-4 mr-2" /> Generar con esta plantilla
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TemplateEditorDialog open={editorOpen} onOpenChange={setEditorOpen} template={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta plantilla?</AlertDialogTitle>
            <AlertDialogDescription>Los contratos ya generados con esta plantilla se conservan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runDeleteTemplate}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
