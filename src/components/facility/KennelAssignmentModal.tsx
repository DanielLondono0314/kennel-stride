import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Dog } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitData {
  id: string;
  name: string;
  status: string;
  assigned_dog_id: string | null;
  assigned_dog_name: string | null;
  assignment_start: string | null;
  assignment_end: string | null;
  notes: string | null;
}

interface KennelAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: UnitData | null;
  dogs: Array<{ id: string; name: string }>;
  onAssign: (unitId: string, data: {
    assigned_dog_id: string;
    assigned_dog_name: string;
    assignment_start: string;
    assignment_end: string;
    notes: string;
    status: string;
  }) => void;
  onRelease: (unitId: string) => void;
  onSetMaintenance: (unitId: string) => void;
  onDeleteUnit: (unitId: string) => void;
}

export function KennelAssignmentModal({
  open, onOpenChange, unit, dogs, onAssign, onRelease, onSetMaintenance, onDeleteUnit,
}: KennelAssignmentModalProps) {
  const [dogId, setDogId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOccupied = unit?.status === "occupied";

  const handleAssign = () => {
    if (!unit || !dogId || !startDate || !endDate) return;
    const dog = dogs.find((d) => d.id === dogId);
    onAssign(unit.id, {
      assigned_dog_id: dogId,
      assigned_dog_name: dog?.name || "",
      assignment_start: startDate.toISOString(),
      assignment_end: endDate.toISOString(),
      notes,
      status: "occupied",
    });
    resetForm();
  };

  const resetForm = () => {
    setDogId("");
    setStartDate(new Date());
    setEndDate(undefined);
    setNotes("");
  };

  useEffect(() => {
    if (open) resetForm();
  }, [open, unit?.id]);

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dog className="h-5 w-5" />
            {unit.name}
          </DialogTitle>
          <DialogDescription>
            {isOccupied
              ? `Asignado a ${unit.assigned_dog_name}`
              : "Asigna un perro a esta perrera"}
          </DialogDescription>
        </DialogHeader>

        {isOccupied ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <p className="text-sm font-medium">🐕 {unit.assigned_dog_name}</p>
              {unit.assignment_start && (
                <p className="text-xs text-muted-foreground">
                  Desde: {format(new Date(unit.assignment_start), "dd MMM yyyy", { locale: es })}
                </p>
              )}
              {unit.assignment_end && (
                <p className="text-xs text-muted-foreground">
                  Hasta: {format(new Date(unit.assignment_end), "dd MMM yyyy", { locale: es })}
                </p>
              )}
              {unit.notes && <p className="text-xs text-muted-foreground">{unit.notes}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => unit && onSetMaintenance(unit.id)}>
                Mantenimiento
              </Button>
              <Button variant="destructive" size="sm" onClick={() => unit && onRelease(unit.id)}>
                Liberar Perrera
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Perro</Label>
              <Select value={dogId} onValueChange={setDogId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar perro..." /></SelectTrigger>
                <SelectContent>
                  {dogs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {startDate ? format(startDate, "dd/MM/yy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {endDate ? format(endDate, "dd/MM/yy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas opcionales..." rows={2} />
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
              <div className="flex gap-2">
                {unit.status !== "maintenance" && (
                  <Button variant="outline" size="sm" onClick={() => onSetMaintenance(unit.id)}>
                    Mantenimiento
                  </Button>
                )}
                <Button size="sm" disabled={!dogId || !startDate || !endDate} onClick={handleAssign}>
                  Asignar Perro
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {unit.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta perrera se eliminará de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDelete(false); onDeleteUnit(unit.id); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
