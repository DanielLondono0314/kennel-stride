import { AlertTriangle, Dog, Leaf, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

/** Foto del perro o, si no tiene, un ícono. */
export function DogAvatar({ photoUrl, name, size = "md" }: { photoUrl: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  return photoUrl ? (
    <img src={photoUrl} alt={`Foto de ${name}`} className={cn(cls, "shrink-0 rounded-full object-cover border")} loading="lazy" />
  ) : (
    <div className={cn(cls, "shrink-0 rounded-full bg-accent/20 flex items-center justify-center")} aria-hidden>
      <Dog className={size === "lg" ? "h-9 w-9 text-accent-foreground" : "h-5 w-5 text-accent-foreground"} />
    </div>
  );
}

/**
 * Alertas del perro con texto, no solo íconos: quien está cuidando al perro
 * tiene que entender de un vistazo si es agresivo, alérgico o toma medicación.
 */
export function DogAlertChips({
  flags,
  className,
}: {
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
  className?: string;
}) {
  if (!flags.aggressive && !flags.allergies && !flags.medication) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {flags.aggressive && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Agresivo
        </span>
      )}
      {flags.allergies && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          <Leaf className="h-3 w-3" aria-hidden /> Alergias
        </span>
      )}
      {flags.medication && (
        <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
          <Pill className="h-3 w-3" aria-hidden /> Medicación
        </span>
      )}
    </div>
  );
}
