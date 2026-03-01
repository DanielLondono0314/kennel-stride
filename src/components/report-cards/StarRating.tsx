import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({ value, onChange, max = 5, size = "md", readonly = false }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= value;
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(starValue)}
            className={cn(
              "transition-colors",
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
              filled ? "text-accent" : "text-muted-foreground/30"
            )}
          >
            <Star className={cn(sizeMap[size], filled && "fill-current")} />
          </button>
        );
      })}
    </div>
  );
}
