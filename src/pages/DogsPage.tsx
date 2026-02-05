import { useState, useMemo } from "react";
import { mockDogs, mockCustomers } from "@/data/mockData";
import { FlagIndicators } from "@/components/shared/FlagIndicators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, Dog, Calendar, Scale } from "lucide-react";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import { es } from "date-fns/locale";

export default function DogsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const dogs = useMemo(() => {
    return mockDogs.map((dog) => ({
      ...dog,
      owner: mockCustomers.find((c) => c.id === dog.customerId),
    }));
  }, []);

  const filteredDogs = useMemo(() => {
    if (!searchQuery) return dogs;
    const query = searchQuery.toLowerCase();
    return dogs.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        d.breed.toLowerCase().includes(query) ||
        d.owner?.firstName.toLowerCase().includes(query) ||
        d.owner?.lastName.toLowerCase().includes(query)
    );
  }, [dogs, searchQuery]);

  const getAge = (birthDate?: Date) => {
    if (!birthDate) return "—";
    const years = differenceInYears(new Date(), birthDate);
    if (years > 0) return `${years} año${years > 1 ? "s" : ""}`;
    const months = differenceInMonths(new Date(), birthDate);
    return `${months} mes${months > 1 ? "es" : ""}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Perros</h1>
          <p className="text-muted-foreground">
            Administra los perfiles de las mascotas registradas
          </p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo perro
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nombre, raza o dueño..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="min-w-[180px]">Perro</TableHead>
              <TableHead>Dueño</TableHead>
              <TableHead>Raza</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDogs.map((dog) => (
              <TableRow key={dog.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow">
                      <AvatarFallback className="bg-accent text-accent-foreground">
                        <Dog className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{dog.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {dog.gender === "male" ? "♂ Macho" : "♀ Hembra"}
                        </span>
                        {dog.isNeutered && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {dog.gender === "male" ? "Castrado" : "Esterilizada"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {dog.owner?.firstName} {dog.owner?.lastName}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{dog.breed}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {getAge(dog.birthDate)}
                  </div>
                </TableCell>
                <TableCell>
                  {dog.weight ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                      {dog.weight} kg
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <FlagIndicators flags={dog.flags} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Nueva reserva</DropdownMenuItem>
                      <DropdownMenuItem>Crear report card</DropdownMenuItem>
                      <DropdownMenuItem>Ver historial</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
