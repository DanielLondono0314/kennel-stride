import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { useDogs, useDeleteDog } from "@/hooks/queries/useDogs";
import { DogModal } from "@/components/dogs/DogModal";
import { DogCharacteristicIcons } from "@/components/dogs/DogCharacteristicIcons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, MoreHorizontal, Dog as DogIcon, Calendar, Scale, Upload } from "lucide-react";
import { ImportDataModal } from "@/components/import/ImportDataModal";
import { differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";

interface DbDog {
  id: string;
  customer_id: string;
  name: string;
  breed: string;
  birth_date: string | null;
  weight: number | null;
  color: string | null;
  gender: string;
  is_neutered: boolean;
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
  microchip_number: string | null;
  notes: string | null;
  behavior_notes: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; first_name: string; last_name: string } | null;
}

export default function DogsPage() {
  const { organization } = useOrganization();
  const orgNavigate = useOrgNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDog, setEditingDog] = useState<DbDog | null>(null);
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isFetching } = useDogs({ page, search: debouncedSearch });
  const dogs = data?.dogs ?? [];
  const hasMore = data?.hasMore ?? false;
  const deleteDog = useDeleteDog();

  const getAge = (birthDate?: string | null) => {
    if (!birthDate) return "—";
    const bd = new Date(birthDate);
    const years = differenceInYears(new Date(), bd);
    if (years > 0) return `${years} año${years > 1 ? "s" : ""}`;
    const months = differenceInMonths(new Date(), bd);
    return `${months} mes${months > 1 ? "es" : ""}`;
  };

  const handleNewDog = () => { setEditingDog(null); setModalOpen(true); };
  const handleEditDog = (dog: DbDog) => { setEditingDog(dog); setModalOpen(true); };

  const handleSave = async (data: any) => {
    const payload = {
      customer_id: data.customer_id,
      name: data.name,
      breed: data.breed,
      birth_date: data.birth_date || null,
      weight: data.weight ? parseFloat(data.weight) : null,
      color: data.color || null,
      gender: data.gender,
      is_neutered: data.is_neutered,
      is_aggressive: data.is_aggressive ?? false,
      has_allergies: data.has_allergies ?? false,
      on_medication: data.on_medication ?? false,
      microchip_number: data.microchip_number || null,
      notes: data.notes || "",
      behavior_notes: data.behavior_notes || "",
      medical_notes: data.medical_notes || "",
      photo_url: data.photo_url ?? null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (data.id && editingDog) {
      ({ error } = await supabase.from("dogs").update(payload).eq("id", data.id));
    } else {
      ({ error } = await supabase.from("dogs").insert({ ...payload, id: data.id, organization_id: organization!.id }));
    }

    if (error) {
      toast.error("Error al guardar perro");
    } else {
      toast.success(editingDog ? "Perro actualizado" : "Perro registrado");
      setModalOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDog.mutateAsync(deleteId);
      toast.success("Mascota eliminada");
    } catch {
      toast.error("Error al eliminar mascota");
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Perros</h1>
          <p className="text-muted-foreground">Administra los perfiles de las mascotas registradas</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNewDog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo perro
          </Button>
        </div>
      </div>

      <ImportDataModal
        open={importOpen}
        onOpenChange={setImportOpen}
        initialTab="dogs"
        onImported={() => { setPage(0); setDebouncedSearch(""); }}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Buscar por nombre, raza o dueño..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[180px]">Perro</TableHead>
              <TableHead>Dueño</TableHead>
              <TableHead>Raza</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : dogs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No se encontraron perros</TableCell></TableRow>
            ) : dogs.map((dog) => (
              <TableRow key={dog.id} className="cursor-pointer" onClick={() => orgNavigate(`/dogs/${dog.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow">
                      {dog.photo_url && <AvatarImage src={dog.photo_url} alt={dog.name} className="object-cover" />}
                      <AvatarFallback className="bg-accent text-accent-foreground"><DogIcon className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{dog.name}</p>
                      <DogCharacteristicIcons
                        isAggressive={dog.is_aggressive}
                        hasAllergies={dog.has_allergies}
                        onMedication={dog.on_medication}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{dog.gender === "male" ? "♂ Macho" : "♀ Hembra"}</span>
                        {dog.is_neutered && <Badge variant="secondary" className="text-[10px] px-1.5">{dog.gender === "male" ? "Castrado" : "Esterilizada"}</Badge>}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><span className="text-sm">{dog.customers?.first_name} {dog.customers?.last_name}</span></TableCell>
                <TableCell><span className="text-sm text-muted-foreground">{dog.breed}</span></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{getAge(dog.birth_date)}</div>
                </TableCell>
                <TableCell>
                  {dog.weight ? (
                    <div className="flex items-center gap-1.5 text-sm"><Scale className="h-3.5 w-3.5 text-muted-foreground" />{dog.weight} kg</div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditDog(dog)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(dog.id)} className="text-destructive">Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : dogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No se encontraron perros</p>
        ) : dogs.map((dog) => (
          <Card
            key={dog.id}
            className="cursor-pointer"
            onClick={() => orgNavigate(`/dogs/${dog.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-12 w-12 border-2 border-background shadow shrink-0">
                    {dog.photo_url && <AvatarImage src={dog.photo_url} alt={dog.name} className="object-cover" />}
                    <AvatarFallback className="bg-accent text-accent-foreground"><DogIcon className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{dog.name}</p>
                    <DogCharacteristicIcons
                      isAggressive={dog.is_aggressive}
                      hasAllergies={dog.has_allergies}
                      onMedication={dog.on_medication}
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{dog.gender === "male" ? "♂ Macho" : "♀ Hembra"}</span>
                      {dog.is_neutered && <Badge variant="secondary" className="text-[10px] px-1.5">{dog.gender === "male" ? "Castrado" : "Esterilizada"}</Badge>}
                    </div>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditDog(dog)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(dog.id)} className="text-destructive">Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Dueño</p>
                  <p className="truncate">{dog.customers?.first_name} {dog.customers?.last_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Raza</p>
                  <p className="truncate text-muted-foreground">{dog.breed}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{getAge(dog.birth_date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {dog.weight ? (
                    <>
                      <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{dog.weight} kg</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin peso</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isFetching}>
            {isFetching ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      )}

      <DogModal dog={editingDog} open={modalOpen} onOpenChange={setModalOpen} onSave={handleSave} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar perro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán también los registros médicos asociados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
