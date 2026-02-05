import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServiceType, FlagType } from "@/types";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface QuickFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  serviceFilter: ServiceType | "all";
  onServiceChange: (value: ServiceType | "all") => void;
  flagFilter: FlagType | "all";
  onFlagChange: (value: FlagType | "all") => void;
  onClearFilters: () => void;
}

const serviceOptions: { value: ServiceType | "all"; label: string }[] = [
  { value: "all", label: "Todos los servicios" },
  { value: ServiceType.DAYCARE, label: "Guardería" },
  { value: ServiceType.BOARD_AND_TRAIN, label: "Internado" },
  { value: ServiceType.TRAINING_SESSION, label: "Sesiones" },
  { value: ServiceType.GROOMING, label: "Grooming" },
  { value: ServiceType.EVALUATION, label: "Evaluación" },
];

const flagOptions: { value: FlagType | "all"; label: string }[] = [
  { value: "all", label: "Todas las alertas" },
  { value: FlagType.VACCINATION_EXPIRED, label: "Vacunas vencidas" },
  { value: FlagType.DOCUMENT_PENDING, label: "Documentos pendientes" },
  { value: FlagType.PAYMENT_OVERDUE, label: "Pagos vencidos" },
  { value: FlagType.BEHAVIOR_ALERT, label: "Alertas de comportamiento" },
  { value: FlagType.MEDICAL_CONDITION, label: "Condiciones médicas" },
];

export function QuickFilters({
  searchQuery,
  onSearchChange,
  serviceFilter,
  onServiceChange,
  flagFilter,
  onFlagChange,
  onClearFilters,
}: QuickFiltersProps) {
  const hasActiveFilters =
    searchQuery !== "" || serviceFilter !== "all" || flagFilter !== "all";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar perro o dueño..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Service filter */}
      <Select
        value={serviceFilter}
        onValueChange={(value) => onServiceChange(value as ServiceType | "all")}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Servicio" />
        </SelectTrigger>
        <SelectContent>
          {serviceOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Flag filter */}
      <Select
        value={flagFilter}
        onValueChange={(value) => onFlagChange(value as FlagType | "all")}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Alertas" />
        </SelectTrigger>
        <SelectContent>
          {flagOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
