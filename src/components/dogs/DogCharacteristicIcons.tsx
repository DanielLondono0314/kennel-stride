import { AlertTriangle, Leaf, Pill } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  isAggressive?: boolean | null;
  hasAllergies?: boolean | null;
  onMedication?: boolean | null;
  size?: "sm" | "md";
}

export function DogCharacteristicIcons({ isAggressive, hasAllergies, onMedication, size = "sm" }: Props) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (!isAggressive && !hasAllergies && !onMedication) return null;

  return (
    <div className="flex items-center gap-1">
      {isAggressive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-destructive/10 text-destructive"
            )}>
              <AlertTriangle className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Perro agresivo</TooltipContent>
        </Tooltip>
      )}
      {hasAllergies && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-amber-600/15 text-amber-700"
            )}>
              <Leaf className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Tiene alergias</TooltipContent>
        </Tooltip>
      )}
      {onMedication && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center justify-center rounded",
              size === "sm" ? "p-0.5" : "p-1",
              "bg-blue-600/15 text-blue-700"
            )}>
              <Pill className={iconClass} />
            </span>
          </TooltipTrigger>
          <TooltipContent>En medicación</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
